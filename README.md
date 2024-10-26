# Gmail To Outlook.com Proxy

https://sendas.email/

Microsoft has discontinued basic authentication for personal Outlook.com accounts. This change affects Gmail's "Send As" feature, which relies on basic SMTP authentication. Since Gmail hasn't updated their SMTP integration, users can no longer send emails through Outlook.com accounts via Gmail. Notably, attempts to connect to the Outlook.com SMTP server smtp-mail.outlook.com results in the following error:

```
Authentication failed. Please check your username/password.
Server returned error: "334 VXNlcm5hbWU6 334 UGFzc3dvcmQ6 535 5.7.139 Authentication unsuccessful, basic authentication is disabled. [AS4P251CA0014.EURP251.PROD.OUTLOOK.COM 2024-10-26T21:19:04.955Z 08DCF55F2D078725] , code: 535"
```

This restores that functionality by presenting a compatible SMTP server to Gmail and using the Microsoft Graph `sendMail` endpoint to send the payload.

I've stood up https://sendas.email/ for myself, but all are welcome to use it if you don't want to go through the setup. The only permission that is requested is `Mail.Send`, which doesn't allow access to your contacts or inbox.

## Setup

1. Have a domain name with valid SSL certificates (https://certbot.eff.org/) and update `SMTP_HOST`, `SMTP_KEY_FILE`, and `SMTP_CERT_FILE` in the `.env`.
2. Register an app with Microsoft Graph (https://learn.microsoft.com/en-us/graph/auth/auth-concepts). This has only been tested on apps for **personal** accounts.
3. Configure the app as a Web platform with valid redirect URIs `https://<HOST>/auth`.
4. Generate a client secret for the app and update `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in the `.env`.
5. Generate your own `SESSION_SECRET` to manage session encryption.
6. `docker-compose up`

## Certificates (Route53)

Reference: https://certbot-dns-route53.readthedocs.io/en/stable/

```
docker run --rm -v \
  "$(pwd)/certificates:/etc/letsencrypt/" \
  -e "AWS_ACCESS_KEY_ID=<YOUR_KEY_ID>" \
  -e "AWS_SECRET_ACCESS_KEY=<YOUR_SECRET_KEY" \
  certbot/dns-route53 \
  certonly \
  --non-interactive \
  --agree-tos \
  --email <YOUR_EMAIL> \
  --dns-route53 \
  -d <YOUR_SMTP_HOST>
```

Then update:

- `SMTP_KEY_FILE`: `certificates/live/<YOUR_SMTP_HOST>/privkey.pem`
- `SMTP_CERT_FILE`: `certificates/live/<YOUR_SMTP_HOST>/fullchain.pem`

## Usage

Usage is pretty straightforward, visit the web app (http://localhost:3000 by default) and authenticate into your Outlook.com account. You'll then be presented with SMTP credentials to use with Gmail.

You can test send locally after authenticating by entering the docker shell and using:

```
npm run smtp:test -- <OUTLOOK_EMAIL> <TARGET_EMAIL>
```

This is configured to ignore cert errors (since it'll be using localhost for the SMTP connection). Your cert will need to be valid for Gmail to connect to it.
