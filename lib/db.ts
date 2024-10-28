import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import _ from "lodash";
import { MicrosoftOAuthCredentials } from "./microsoft";

export type Connection = Database;

let db: Connection | undefined;

export type User = {
  email: string;
  token: MicrosoftOAuthCredentials;
  smtp_password: string;
};

export async function getDb() {
  if (!db) {
    const filename = process.env.SQLITE_PATH!;
    db = await open({
      filename,
      driver: sqlite3.Database,
    });
    // create schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS Tokens (
        email TEXT NOT NULL PRIMARY KEY,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT (datetime('now')),
        updated_at TIMESTAMP DEFAULT (datetime('now')),
        smtp_password TEXT NOT NULL
      );
    `);
  }
  return db;
}

export async function endDb() {
  if (db) {
    await db.close();
    db = undefined;
  }
}

export async function getUser(email?: string): Promise<User | undefined> {
  const db = await getDb();
  const result = await db.get<{
    email: string;
    token: string;
    smtp_password: string;
  }>(`SELECT * FROM Tokens WHERE email = ?`, email);
  return result
    ? {
        email: result.email,
        token: JSON.parse(result.token),
        smtp_password: result.smtp_password,
      }
    : undefined;
}

export async function updateUserSmtpPassword(
  email: string,
  smtp_password: string
) {
  const db = await getDb();
  await db.run(
    `UPDATE Tokens SET smtp_password = ? WHERE email = ?`,
    smtp_password,
    email
  );
  return await getUser(email);
}

export async function upsert<T extends { [f: string]: any }>(
  table: string,
  arr: Array<T>,
  options?: {
    ignoreIfSetFields?: Array<keyof T>;
  }
) {
  if (!arr.length) {
    return;
  }

  const db = await getDb();
  const fields = _.keys(_.first(arr));
  const ignoreIfSetFields = new Set(options?.ignoreIfSetFields);

  for (const row of arr) {
    const placeholders = fields.map(() => "?").join(",");
    const updateClauses = fields
      .filter((f) => !ignoreIfSetFields.has(f as keyof T))
      .map((f) => `${f} = excluded.${f}`)
      .join(",");
    const query = `
      INSERT INTO ${table} (${fields.join(",")})
      VALUES (${placeholders})
      ON CONFLICT DO UPDATE SET
      ${updateClauses}
    `;
    await db.run(
      query,
      _.map(fields, (f) => row[f])
    );
  }
}
