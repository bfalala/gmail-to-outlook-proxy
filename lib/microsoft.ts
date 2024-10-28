import qs from "node:querystring";
import { Client } from "@microsoft/microsoft-graph-client";
import rp from "request-promise-native";
import { getUser, upsert } from "./db";
import crypto from "node:crypto";

// https://learn.microsoft.com/en-us/graph/auth-v2-user?tabs=curl
// https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/quickStartType~/null/sourceType/Microsoft_AAD_IAM/appId/770fcbe8-e94c-41ed-a7c9-9f05d41aca9d/objectId/6ec2e516-d2bb-4e4d-af38-99cf6f90b6f0/isMSAApp~/false/defaultBlade/Overview/appSignInAudience/PersonalMicrosoftAccount
const scopes = ["https://graph.microsoft.com/.default", "offline_access"];
const clientId = process.env.MICROSOFT_CLIENT_ID!;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
const tenantId = "consumers";

export type MicrosoftOAuthCredentials = {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
  refresh_token: string;
  expires: number;
};

export const getCredentials = async (email: string) => {
  const user = await getUser(email);
  const token = user?.token;
  if (!token) {
    throw new Error(`No token found for ${email}.`);
  }
  const credentials: MicrosoftOAuthCredentials = token;
  if (credentials.expires < Date.now() - 5 * 60 * 1000) {
    return refreshCredentials(credentials);
  }
  return credentials;
};

export function getAuthorizationUrl(redirectUrl: string) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${qs.stringify(
    {
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUrl,
      response_mode: "form_post",
      scope: scopes.join(" "),
      client_secret: clientSecret,
      prompt: "select_account",
      state: JSON.stringify({}),
    }
  )}`;
}

export async function exchangeForCredentials(
  redirectUrl: string,
  code: string
) {
  const credentials: MicrosoftOAuthCredentials = await rp.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      formData: {
        client_id: clientId,
        scope: scopes.join(" "),
        code: code,
        redirect_uri: redirectUrl,
        grant_type: "authorization_code",
        client_secret: clientSecret,
      },
      json: true,
    }
  );
  credentials.expires = Date.now() + credentials.expires_in * 1000;
  const { email } = await setCredentials(credentials);
  return { email, credentials };
}

async function refreshCredentials(credentials: MicrosoftOAuthCredentials) {
  const token: MicrosoftOAuthCredentials = await rp.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      formData: {
        client_id: clientId,
        scope: scopes.join(" "),
        refresh_token: credentials.refresh_token,
        grant_type: "refresh_token",
        client_secret: clientSecret,
      },
      json: true,
    }
  );
  token.expires = Date.now() + token.expires_in * 1000;
  await setCredentials(token);
  return token;
}

export async function setCredentials(credentials: MicrosoftOAuthCredentials) {
  const client = getMicrosoftGraphClient(credentials);
  const { userPrincipalName: email } = await client.api("/me").get();
  await upsert(
    "Tokens",
    [
      {
        email,
        token: JSON.stringify(credentials),
        smtp_password: crypto.randomBytes(16).toString("hex"),
        updated_at: new Date().toISOString(),
      },
    ],
    { ignoreIfSetFields: ["smtp_password"] }
  );
  return {
    email,
    credentials,
  };
}

export function getMicrosoftGraphClient(token: MicrosoftOAuthCredentials) {
  const client = Client.init({
    authProvider: async (done) => {
      try {
        done(null, token.access_token);
      } catch (err) {
        done(err, null);
      }
    },
  });
  return client;
}
