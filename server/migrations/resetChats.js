/**
 * Reset Chat Data
 *
 * Clears all chats and messages from MongoDB while leaving users untouched
 * (in both Mongo and Auth0). Useful for re-running test scenarios without
 * losing the seeded default user.
 *
 * Usage:
 *   npm run reset:chats
 *
 * Effect:
 *   - chats collection:    deleteMany({})  (all docs removed)
 *   - messages collection: deleteMany({})  (all docs removed)
 *   - users collection:    untouched
 *   - Auth0 users:         untouched
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from "readline";
import { isDocker } from "../config/runtime.js";

dotenv.config();

let MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/chat";
if (!isDocker) MONGO_URL = MONGO_URL.replace("//mongo:", "//localhost:");

const args = process.argv.slice(2);
const skipConfirm = args.includes("--yes") || args.includes("-y");

const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const cyan = (t) => `\x1b[36m${t}\x1b[0m`;

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log(cyan("\n=== Reset Chat Data ===\n"));
  console.log(`  MongoDB URL: ${yellow(MONGO_URL)}`);
  console.log(red("\n  This will DELETE all documents in `chats` and `messages`."));
  console.log("  Users (Mongo + Auth0) will NOT be touched.\n");

  if (!skipConfirm) {
    const answer = await confirm("Continue? (y/N) ");
    if (answer !== "y" && answer !== "yes") {
      console.log(yellow("\nAborted."));
      process.exit(0);
    }
  }

  try {
    await mongoose.connect(MONGO_URL);
    console.log(green("\n[OK]") + " Connected to MongoDB");
  } catch (err) {
    console.error(red("[FAIL]") + " Cannot connect to MongoDB:", err.message);
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const existing = (await db.listCollections().toArray()).map((c) => c.name);

  for (const name of ["messages", "chats"]) {
    if (!existing.includes(name)) {
      console.log(yellow(`  ${name} collection does not exist — skipping`));
      continue;
    }
    const before = await db.collection(name).countDocuments();
    const result = await db.collection(name).deleteMany({});
    console.log(green(`  Cleared ${name}: ${result.deletedCount} docs deleted (was ${before})`));
  }

  // Verify users untouched
  if (existing.includes("users")) {
    const userCount = await db.collection("users").countDocuments();
    console.log(cyan(`\n  Users remaining: ${userCount} (untouched)`));
  }

  console.log(green("\nDone.\n"));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(red("\nReset failed:"), err);
  process.exit(1);
});
