import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData } from "../../lib/state";
import { getUser } from "../../lib/db";

export async function getSessionUser() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: process.env.SESSION_COOKIE!,
  });
  if (!session?.email) {
    throw new Error("Unauthorized.");
  }
  const user = await getUser(session.email);
  if (!user) {
    throw new Error("Unauthorized.");
  }
  return user;
}
