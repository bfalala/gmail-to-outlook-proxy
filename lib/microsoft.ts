import qs from "node:querystring";
import { Client } from "@microsoft/microsoft-graph-client";
import rp from "request-promise-native";
import { getUser, upsert } from "./db";
import crypto from "node:crypto";
import { throatNamespace } from "./throat";
import _ from "lodash";

type MicrosoftAppRegistration = { id: string; secret: string };

export type MicrosoftOAuthCredentials = {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
  refresh_token: string;
  expires: number;
};

// https://learn.microsoft.com/en-us/graph/auth-v2-user?tabs=curl
// https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/quickStartType~/null/sourceType/Microsoft_AAD_IAM/appId/770fcbe8-e94c-41ed-a7c9-9f05d41aca9d/objectId/6ec2e516-d2bb-4e4d-af38-99cf6f90b6f0/isMSAApp~/false/defaultBlade/Overview/appSignInAudience/PersonalMicrosoftAccount
// support multiple app registrations
const appsArray: MicrosoftAppRegistration[] = JSON.parse(
  process.env.MICROSOFT_APPS!
);
const apps = _.keyBy(appsArray, "id");
const scopes = ["https://graph.microsoft.com/.default", "offline_access"];
const tenantId = "consumers";
const clientDefaultId =
  process.env.MICROSOFT_APPS_DEFAULT_ID ?? appsArray[0].id;

export function getApp(id: string = clientDefaultId) {
  if (!apps[id]) {
    throw new Error(`No client found for ${id}.`);
  }
  return apps[id];
}

export const getCredentials = throatNamespace(
  1,
  async (email: string, app: MicrosoftAppRegistration) => {
    const user = await getUser(email);
    const token = user?.token;
    if (!token) {
      throw new Error(`No token found for ${email}.`);
    }
    const credentials: MicrosoftOAuthCredentials = token;
    if (credentials.expires < Date.now() - 5 * 60 * 1000) {
      return refreshCredentials(credentials, app);
    }
    return credentials;
  }
);

export function getAuthorizationUrl(
  redirectUrl: string,
  app: MicrosoftAppRegistration
) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${qs.stringify(
    {
      client_id: app.id,
      response_type: "code",
      redirect_uri: redirectUrl,
      response_mode: "form_post",
      scope: scopes.join(" "),
      client_secret: app.secret,
      prompt: "select_account",
      state: JSON.stringify({}),
    }
  )}`;
}

export async function exchangeForCredentials(
  redirectUrl: string,
  code: string,
  app: MicrosoftAppRegistration
) {
  const credentials: MicrosoftOAuthCredentials = await rp.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      formData: {
        client_id: app.id,
        scope: scopes.join(" "),
        code: code,
        redirect_uri: redirectUrl,
        grant_type: "authorization_code",
        client_secret: app.secret,
      },
      json: true,
    }
  );
  credentials.expires = Date.now() + credentials.expires_in * 1000;
  const { email } = await setCredentials(credentials, app);
  return { email, credentials };
}

async function refreshCredentials(
  credentials: MicrosoftOAuthCredentials,
  app: MicrosoftAppRegistration
) {
  const token: MicrosoftOAuthCredentials = await rp.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      formData: {
        client_id: app.id,
        scope: scopes.join(" "),
        refresh_token: credentials.refresh_token,
        grant_type: "refresh_token",
        client_secret: app.secret,
      },
      json: true,
    }
  );
  token.expires = Date.now() + token.expires_in * 1000;
  await setCredentials(token, app);
  return token;
}

export async function setCredentials(
  credentials: MicrosoftOAuthCredentials,
  app: MicrosoftAppRegistration
) {
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
        app_id: app.id,
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
