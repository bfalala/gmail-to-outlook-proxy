import { updateUserSmtpPassword } from "../../../lib/db";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser } from "../shared";

export async function POST() {
  const user = await getSessionUser();
  const updatedUser = await updateUserSmtpPassword(
    user.email,
    crypto.randomBytes(16).toString("hex")
  );
  return NextResponse.json(updatedUser);
}
