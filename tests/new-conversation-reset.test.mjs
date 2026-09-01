import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("new conversation always resets the draft and acknowledges the click", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const \[newConversationVersion, setNewConversationVersion\] = useState\(0\)/);
  assert.match(page, /setNewConversationVersion\(\(current\) => current \+ 1\)/);
  assert.match(page, /key=\{`\$\{conversationId \|\| "new"\}:\$\{newConversationVersion\}`\}/);
  assert.match(page, /setNotice\("已开始新对话"\)/);
  assert.match(page, /autoFocus=\{autoFocusComposer\}/);
});
