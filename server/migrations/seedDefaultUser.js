/**
 * Seed Default User
 *
 * Creates a default test user in BOTH Auth0 and MongoDB so the user can log in
 * to the app immediately after a fresh setup.
 *
 *   Email:    alwinpkunjachan@gmail.com
 *   Username: alwinpkunjachan
 *   Password: process.env.DEFAULT_USER_PASSWORD  (fallback: "Default@123")
 *   Role:     USER
 *
 * Idempotent — safe to run multiple times.
 *   - If the Auth0 user already exists, the script looks it up by email.
 *   - If the Mongo user already exists, the script upserts auth0_id and profile flags.
 *
 * Usage:
 *   npm run seed:user
 *
 * Prerequisites:
 *   - AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET in .env
 *   - Auth0 "USER" role must exist
 *   - Migration has been run (`npm run migrate`) so collections + validators exist
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { ManagementClient } from "auth0";
import { isDocker } from "../config/runtime.js";

dotenv.config();

const DEFAULT_EMAIL = "alwinpkunjachan@gmail.com";
const DEFAULT_USERNAME = "alwinpkunjachan";
const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "Default@123";

let MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/chat";
if (!isDocker) MONGO_URL = MONGO_URL.replace("//mongo:", "//localhost:");

const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const cyan = (t) => `\x1b[36m${t}\x1b[0m`;

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_M2M_CLIENT_ID,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
});

async function ensureAuth0User() {
  // Look up first — most idempotent path
  try {
    const existing = await auth0.usersByEmail.getByEmail({ email: DEFAULT_EMAIL });
    if (existing.data.length > 0) {
      console.log(yellow(`  Auth0 user already exists: ${existing.data[0].user_id}`));
      return existing.data[0].user_id;
    }
  } catch (err) {
    console.log(yellow(`  Could not pre-check Auth0 user (continuing to create): ${err.message}`));
  }

  try {
    const created = await auth0.users.create({
      connection: "Username-Password-Authentication",
      email: DEFAULT_EMAIL,
      username: DEFAULT_USERNAME,
      password: DEFAULT_PASSWORD,
      name: DEFAULT_USERNAME,
      email_verified: true,
    });
    console.log(green(`  Auth0 user created: ${created.data.user_id}`));
    return created.data.user_id;
  } catch (err) {
    if (err.statusCode === 409 || err.message?.includes("already exists")) {
      const existing = await auth0.usersByEmail.getByEmail({ email: DEFAULT_EMAIL });
      if (existing.data.length > 0) {
        console.log(yellow(`  Auth0 user already exists (race): ${existing.data[0].user_id}`));
        return existing.data[0].user_id;
      }
    }
    throw err;
  }
}

async function ensureUserRole(auth0Id) {
  let userRoleId;
  try {
    const roles = await auth0.roles.getAll();
    userRoleId = roles.data.find((r) => r.name === "USER")?.id;
  } catch (err) {
    console.log(yellow(`  Could not fetch Auth0 roles: ${err.message}`));
    return;
  }

  if (!userRoleId) {
    console.log(yellow("  USER role not found in Auth0 — skipping role assignment"));
    return;
  }

  try {
    await auth0.users.assignRoles({ id: auth0Id }, { roles: [userRoleId] });
    console.log(green(`  Assigned USER role`));
  } catch (err) {
    console.log(yellow(`  Could not assign USER role (may already be assigned): ${err.message}`));
  }
}

async function upsertMongoUser(auth0Id) {
  const usersCollection = mongoose.connection.db.collection("users");

  const result = await usersCollection.updateOne(
    { email: DEFAULT_EMAIL },
    {
      $set: {
        auth0_id: auth0Id,
        is_profile_complete: true,
        is_active: true,
        role: "USER",
        updated_at: new Date(),
      },
      $setOnInsert: {
        username: DEFAULT_USERNAME,
        email: DEFAULT_EMAIL,
        firstname: "Alwin",
        lastname: "Kunjachan",
        gender: "M",
        is_online: false,
        is_flagged: false,
        flag_count: 0,
        created_at: new Date(),
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(green(`  Mongo user created (_id: ${result.upsertedId._id})`));
  } else {
    console.log(yellow(`  Mongo user already existed — updated auth0_id`));
  }
}

async function main() {
  console.log(cyan("\n=== Seed Default User ===\n"));
  console.log(`  MongoDB URL: ${yellow(MONGO_URL)}`);
  console.log(`  Email:       ${yellow(DEFAULT_EMAIL)}`);
  console.log(`  Username:    ${yellow(DEFAULT_USERNAME)}`);
  console.log(`  Password:    ${yellow(process.env.DEFAULT_USER_PASSWORD ? "<from DEFAULT_USER_PASSWORD env>" : "Default@123 (fallback)")}\n`);

  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_M2M_CLIENT_ID || !process.env.AUTH0_M2M_CLIENT_SECRET) {
    console.error(red("[FAIL]") + " Missing Auth0 M2M credentials in .env (AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET)");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URL);
    console.log(green("[OK]") + " Connected to MongoDB\n");
  } catch (err) {
    console.error(red("[FAIL]") + " Cannot connect to MongoDB:", err.message);
    process.exit(1);
  }

  try {
    console.log("Auth0:");
    const auth0Id = await ensureAuth0User();
    await ensureUserRole(auth0Id);

    console.log("\nMongoDB:");
    await upsertMongoUser(auth0Id);

    console.log(green("\nDone."));
    console.log(cyan(`\nLogin at the user app (http://localhost:5173) with:`));
    console.log(`  Email:    ${DEFAULT_EMAIL}`);
    console.log(`  Password: ${process.env.DEFAULT_USER_PASSWORD ? "<DEFAULT_USER_PASSWORD>" : "Default@123"}\n`);
  } catch (err) {
    console.error(red("\nSeed failed:"), err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(red("\nSeed failed:"), err);
  process.exit(1);
});
