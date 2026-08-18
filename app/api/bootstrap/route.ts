import { asc, desc, eq } from "drizzle-orm";
import { consents, conversations, deviceConnections, goals, healthRecords, healthSubjects, users } from "../../../db/schema";
import { apiIdentity, audit, db, id, now, unauthorized } from "../_lib";

export async function GET(request:Request){
  const identity=await apiIdentity(request); if(!identity)return unauthorized();
  const database=db();
  await database.insert(users).values({id:identity.userId,email:identity.email,displayName:identity.displayName}).onConflictDoUpdate({target:users.id,set:{email:identity.email,displayName:identity.displayName,updatedAt:now()}});
  let subjects=await database.select().from(healthSubjects).where(eq(healthSubjects.ownerUserId,identity.userId)).orderBy(asc(healthSubjects.createdAt));
  if(!subjects.length){const subjectId=id("subject");await database.insert(healthSubjects).values({id:subjectId,ownerUserId:identity.userId,name:"我",relation:"self"});subjects=await database.select().from(healthSubjects).where(eq(healthSubjects.ownerUserId,identity.userId));await audit(identity.userId,"subject_created","health_subject",subjectId,subjectId,{relation:"self"});}
  const [permissionRows,conversationRows,recordRows,goalRows,deviceRows]=await Promise.all([
    database.select().from(consents).where(eq(consents.ownerUserId,identity.userId)),
    database.select().from(conversations).where(eq(conversations.ownerUserId,identity.userId)).orderBy(desc(conversations.updatedAt)).limit(30),
    database.select().from(healthRecords).where(eq(healthRecords.ownerUserId,identity.userId)).orderBy(desc(healthRecords.occurredAt)).limit(50),
    database.select().from(goals).where(eq(goals.ownerUserId,identity.userId)).orderBy(desc(goals.updatedAt)).limit(30),
    database.select().from(deviceConnections).where(eq(deviceConnections.ownerUserId,identity.userId)),
  ]);
  return Response.json({user:{id:identity.userId,email:identity.email,displayName:identity.displayName},subjects,consents:permissionRows,conversations:conversationRows,records:recordRows,goals:goalRows,devices:deviceRows});
}
