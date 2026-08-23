export type AccountDeletionDependencies = {
  listObjectKeys(ownerUserId: string): Promise<string[]>;
  deleteObject(objectKey: string): Promise<void>;
  recordAudit(ownerUserId: string, deletedObjectCount: number): Promise<void>;
  deleteUser(ownerUserId: string): Promise<void>;
};

type ObjectStore = {
  list(options: { prefix: string; cursor?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
};

export async function listOwnedObjectKeys(store: ObjectStore, ownerUserId: string) {
  const objectKeys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.list({ prefix: `${ownerUserId}/`, cursor });
    objectKeys.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objectKeys;
}

export async function deleteAccountData(
  ownerUserId: string,
  dependencies: AccountDeletionDependencies,
) {
  const objectKeys = await dependencies.listObjectKeys(ownerUserId);
  try {
    await Promise.all(objectKeys.map((objectKey) => dependencies.deleteObject(objectKey)));
  } catch (cause) {
    throw new Error("account_object_cleanup_failed", { cause });
  }

  await dependencies.recordAudit(ownerUserId, objectKeys.length);
  await dependencies.deleteUser(ownerUserId);
  return { deletedObjectCount: objectKeys.length };
}
