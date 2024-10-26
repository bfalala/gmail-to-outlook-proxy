import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData } from "../../lib/state";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: process.env.SESSION_COOKIE!,
  });
  session.destroy();
  return redirect("/");
}
