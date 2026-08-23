import { and, asc, desc, eq } from "drizzle-orm";
import { consents, conversations, goals, healthSubjects, users } from "../../../db/schema";
import { apiIdentity, audit, db, id, now, unauthorized } from "../_lib";

export async function GET(request: Request) {
  const identity = await apiIdentity(request);
  if (!identity) return unauthorized();
  const database = db();
  await database.insert(users).values({ id: identity.userId, email: identity.email, displayName: identity.displayName }).onConflictDoUpdate({ target: users.id, set: { email: identity.email, displayName: identity.displayName, updatedAt: now() } });
  const subjects = await database.select().from(healthSubjects).where(eq(healthSubjects.ownerUserId, identity.userId)).orderBy(asc(healthSubjects.createdAt));
  let subject = subjects.find((item) => item.relation === "self") ?? subjects[0];
  if (!subject) {
    const subjectId = id("subject");
    await database.insert(healthSubjects).values({ id: subjectId, ownerUserId: identity.userId, name: "我", relation: "self", profileJson: "{}" });
    subject = (await database.select().from(healthSubjects).where(eq(healthSubjects.id, subjectId)).limit(1))[0];
    await audit(identity.userId, "subject_created", "lifestyle_profile", subjectId, subjectId, { relation: "self" });
  }
  const [permissionRows, conversationRows, goalRows] = await Promise.all([
    database.select().from(consents).where(eq(consents.ownerUserId, identity.userId)).orderBy(asc(consents.createdAt)),
    database.select().from(conversations).where(and(eq(conversations.ownerUserId, identity.userId), eq(conversations.productScope, "lifestyle"))).orderBy(desc(conversations.updatedAt)).limit(30),
    database.select().from(goals).where(eq(goals.ownerUserId, identity.userId)).orderBy(desc(goals.updatedAt)).limit(30),
  ]);
  return Response.json({ user: { id: identity.userId, email: identity.email, displayName: identity.displayName }, subject, consents: permissionRows, conversations: conversationRows, goals: goalRows });
}
