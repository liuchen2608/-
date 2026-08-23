import assert from "node:assert/strict";
import test from "node:test";
import { deleteAccountData, listOwnedObjectKeys } from "../app/api/account-deletion.ts";

test("account deletion removes stored objects before deleting the user", async () => {
  const events = [];
  const result = await deleteAccountData("user-1", {
    listObjectKeys: async () => ["user-1/file-a", "user-1/file-b"],
    deleteObject: async (key) => events.push(`object:${key}`),
    recordAudit: async (_userId, count) => events.push(`audit:${count}`),
    deleteUser: async (userId) => events.push(`user:${userId}`),
  });

  assert.deepEqual(events, [
    "object:user-1/file-a",
    "object:user-1/file-b",
    "audit:2",
    "user:user-1",
  ]);
  assert.deepEqual(result, { deletedObjectCount: 2 });
});

test("account deletion preserves database records when object cleanup fails", async () => {
  let userDeleted = false;
  await assert.rejects(() => deleteAccountData("user-1", {
    listObjectKeys: async () => ["user-1/file-a"],
    deleteObject: async () => { throw new Error("storage unavailable"); },
    recordAudit: async () => {},
    deleteUser: async () => { userDeleted = true; },
  }), /account_object_cleanup_failed/);
  assert.equal(userDeleted, false);
});

test("account deletion enumerates every R2 object under the user's prefix", async () => {
  const requests = [];
  const keys = await listOwnedObjectKeys({
    list: async (options) => {
      requests.push(options);
      if (!options.cursor) return { objects: [{ key: "user-1/a" }], truncated: true, cursor: "next" };
      return { objects: [{ key: "user-1/orphan" }], truncated: false };
    },
  }, "user-1");
  assert.deepEqual(requests, [
    { prefix: "user-1/", cursor: undefined },
    { prefix: "user-1/", cursor: "next" },
  ]);
  assert.deepEqual(keys, ["user-1/a", "user-1/orphan"]);
});
