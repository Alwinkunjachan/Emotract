/**
 * Auth0 Migration Script for MERN-NLP-Emotract
 *
 * Migrates existing MongoDB users to Auth0 by:
 * 1. Creating an Auth0 account for each user
 * 2. Assigning the appropriate role (USER or ADMIN)
 * 3. Updating the MongoDB record with the Auth0 user_id
 *
 * - Admin user gets the password from ADMIN_PASSWORD in .env
 * - Regular users get a random temp password (must use "Forgot Password" to reset)
 *
 * Usage:
 *   node migrations/migrateToAuth0.js
 *
 * Prerequisites:
 *   - AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET in .env
 *   - ADMIN_PASSWORD in .env (used as the admin's Auth0 password)
 *   - Auth0 roles "USER" and "ADMIN" must exist
 *   - Auth0 M2M app must be authorized for the Management API
 *   - "Requires Username" must be enabled in Auth0 Database Connection settings
 */

import mongoose from "mongoose";
import crypto from "crypto";
import dotenv from "dotenv";
import { ManagementClient } from "auth0";
import { isDocker } from "../config/runtime.js";

dotenv.config();

let MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/chat";
if (!isDocker) MONGO_URL = MONGO_URL.replace("//mongo:", "//localhost:");

// ─── Color helpers ──────────────────────────────────────────────────
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const cyan = (t) => `\x1b[36m${t}\x1b[0m`;

// ─── Auth0 Management Client ────────────────────────────────────────
const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_M2M_CLIENT_ID,
  clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
});

// ─── Rate limiting helper ───────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(cyan("\n=== Auth0 Migration Script ===\n"));

  // Connect to MongoDB
  await mongoose.connect(MONGO_URL);
  console.log(green("Connected to MongoDB"));

  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");

  // Fetch all users that don't already have an auth0_id
  const users = await usersCollection
    .find({ $or: [{ auth0_id: { $exists: false } }, { auth0_id: null }] })
    .toArray();

  console.log(cyan(`Found ${users.length} users to migrate\n`));

  if (users.length === 0) {
    console.log(yellow("No users to migrate. All users already have auth0_id."));
    await mongoose.disconnect();
    return;
  }

  // Fetch Auth0 roles
  let userRoleId, adminRoleId;
  try {
    const roles = await auth0.roles.getAll();
    const userRole = roles.data.find((r) => r.name === "USER");
    const adminRole = roles.data.find((r) => r.name === "ADMIN");
    userRoleId = userRole?.id;
    adminRoleId = adminRole?.id;

    if (!userRoleId) console.log(yellow("Warning: USER role not found in Auth0"));
    if (!adminRoleId) console.log(yellow("Warning: ADMIN role not found in Auth0"));
  } catch (err) {
    console.error(red("Failed to fetch Auth0 roles:"), err.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    // Admin gets the known password from .env; regular users get a random temp password
    const isAdmin = user.role === "ADMIN";
    let password;

    if (isAdmin && adminPassword) {
      // Use the configured admin password so you can log in immediately
      password = adminPassword;
    } else {
      // Random password — user must use "Forgot Password" to reset
      password = crypto.randomBytes(16).toString("hex") + "Aa1!";
    }

    try {
      let auth0Id;

      try {
        // Try to create user in Auth0
        const auth0User = await auth0.users.create({
          connection: "Username-Password-Authentication",
          email: user.email,
          username: user.username,
          password,
          name: `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.username,
        });
        auth0Id = auth0User.data.user_id;
      } catch (createErr) {
        // If user already exists in Auth0, look them up by email
        if (createErr.statusCode === 409 || createErr.message?.includes("already exists")) {
          console.log(yellow(`  User ${user.username} already exists in Auth0, linking...`));
          const existing = await auth0.usersByEmail.getByEmail({ email: user.email });
          if (existing.data.length > 0) {
            auth0Id = existing.data[0].user_id;
          } else {
            throw new Error(`User exists in Auth0 but could not find by email: ${user.email}`);
          }
        } else {
          throw createErr;
        }
      }

      // Assign role
      const roleId = isAdmin ? adminRoleId : userRoleId;
      if (roleId) {
        try {
          await auth0.users.assignRoles({ id: auth0Id }, { roles: [roleId] });
        } catch (roleErr) {
          // Role may already be assigned — that's fine
          console.log(yellow(`  Warning: Could not assign role for ${user.username}: ${roleErr.message}`));
        }
      }

      // Update MongoDB with auth0_id
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { auth0_id: auth0Id } }
      );

      if (isAdmin) {
        console.log(green(`  Migrated ADMIN: ${user.username} (${user.email}) -> ${auth0Id}`));
        console.log(cyan(`    Login with: username="${user.username}", password=<ADMIN_PASSWORD from .env>`));
      } else {
        console.log(green(`  Migrated: ${user.username} (${user.email}) -> ${auth0Id}`));
      }
      successCount++;
    } catch (err) {
      console.log(red(`  Failed: ${user.username} (${user.email}) - ${err.message}`));
      failCount++;
    }

    // Rate limit: ~20 requests/sec to stay well within Auth0 limits
    await sleep(100);
  }

  console.log(cyan("\n=== Migration Summary ==="));
  console.log(green(`  Success: ${successCount}`));
  if (failCount > 0) console.log(red(`  Failed:  ${failCount}`));
  console.log(yellow("\n  Admin login: username from .env, password from ADMIN_PASSWORD in .env"));
  console.log(yellow("  Regular users must use 'Forgot Password' on Auth0 to set their new password.\n"));

  await mongoose.disconnect();
  console.log(green("Disconnected from MongoDB"));
}

main().catch((err) => {
  console.error(red("Migration failed:"), err);
  process.exit(1);
});
