import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  exchangeForCredentials,
  getAuthorizationUrl,
} from "../../lib/microsoft";
import qs from "node:querystring";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData } from "../../lib/state";

function getCallbackUrl(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = new URL("/auth", `${protocol}://${host}`).toString();
  return callbackUrl;
}

export async function GET(req: NextRequest) {
  const redirectUrl = getAuthorizationUrl(getCallbackUrl(req));
  return NextResponse.redirect(redirectUrl);
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET!,
    cookieName: process.env.SESSION_COOKIE!,
  });
  const body = qs.parse(await req.text()) as {
    code: string;
    state: string;
  };
  const { email } = await exchangeForCredentials(
    getCallbackUrl(req),
    body.code
  );
  session.email = email;
  await session.save();
  return redirect("/configuration");
}
