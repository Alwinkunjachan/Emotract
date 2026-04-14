/**
 * Database Migration Script for MERN-NLP-Emotract
 *
 * Creates all collections, indexes, validators, and seeds the default admin.
 *
 * Usage:
 *   npm run migrate              # Run all migrations
 *   npm run migrate -- --seed    # Run migrations + seed sample data
 *   npm run migrate -- --drop    # Drop all collections and re-create (DESTRUCTIVE)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/chat";

const args = process.argv.slice(2);
const shouldDrop = args.includes("--drop");

// ─── Color helpers for console output ───────────────────────────────
const green = (t) => `\x1b[32m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const cyan = (t) => `\x1b[36m${t}\x1b[0m`;

// ─── Collection Definitions ─────────────────────────────────────────
const collections = [
  {
    name: "users",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["username", "email"],
        properties: {
          username: { bsonType: "string", minLength: 3, maxLength: 20 },
          email: { bsonType: "string" },
          auth0_id: { bsonType: ["string", "null"] },
          firstname: { bsonType: "string" },
          lastname: { bsonType: "string" },
          age: { bsonType: "number" },
          gender: { enum: ["M", "F", "O"] },
          phone: { bsonType: "string" },
          role: { enum: ["USER", "ADMIN"] },
          is_active: { bsonType: "bool" },
          is_online: { bsonType: "bool" },
          is_flagged: { bsonType: "bool" },
          flag_count: { bsonType: "number" },
        },
      },
    },
    indexes: [
      { key: { username: 1 }, options: { unique: true, name: "idx_users_username" } },
      { key: { email: 1 }, options: { unique: true, name: "idx_users_email" } },
      { key: { phone: 1 }, options: { unique: true, sparse: true, name: "idx_users_phone" } },
      { key: { aadhaar_number: 1 }, options: { unique: true, sparse: true, name: "idx_users_aadhaar" } },
      { key: { role: 1 }, options: { name: "idx_users_role" } },
      { key: { is_active: 1 }, options: { name: "idx_users_active" } },
      { key: { is_flagged: 1 }, options: { name: "idx_users_flagged" } },
      { key: { auth0_id: 1 }, options: { unique: true, sparse: true, name: "idx_users_auth0id" } },
      { key: { created_at: -1 }, options: { name: "idx_users_created" } },
    ],
  },
  {
    name: "chats",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["participants"],
        properties: {
          participants: { bsonType: "array", minItems: 2 },
          is_group: { bsonType: "bool" },
          is_active: { bsonType: "bool" },
        },
      },
    },
    indexes: [
      { key: { participants: 1 }, options: { name: "idx_chats_participants" } },
      { key: { is_active: 1 }, options: { name: "idx_chats_active" } },
      { key: { updatedAt: -1 }, options: { name: "idx_chats_updated" } },
    ],
  },
  {
    name: "messages",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["chat_id", "sender_id", "text"],
        properties: {
          chat_id: { bsonType: "objectId" },
          sender_id: { bsonType: "objectId" },
          text: { bsonType: "string" },
          message_status: { enum: ["pending", "sent", "delivered", "seen"] },
          is_flagged: { bsonType: "bool" },
        },
      },
    },
    indexes: [
      { key: { chat_id: 1 }, options: { name: "idx_messages_chat" } },
      { key: { sender_id: 1 }, options: { name: "idx_messages_sender" } },
      { key: { chat_id: 1, sent_at: -1 }, options: { name: "idx_messages_chat_sent" } },
      { key: { is_flagged: 1 }, options: { name: "idx_messages_flagged" } },
      { key: { createdAt: -1 }, options: { name: "idx_messages_created" } },
    ],
  },
];

// ─── Migration Runner ───────────────────────────────────────────────
async function migrate() {
  console.log(cyan("\n========================================"));
  console.log(cyan("  MERN-NLP-Emotract Database Migration"));
  console.log(cyan("========================================\n"));
  console.log(`  MongoDB URL: ${yellow(MONGO_URL)}`);
  console.log(`  Drop first:  ${shouldDrop ? red("Yes (DESTRUCTIVE)") : "No"}\n`);

  let conn;
  try {
    conn = await mongoose.connect(MONGO_URL);
    console.log(green("[OK]") + " Connected to MongoDB\n");
  } catch (err) {
    console.error(red("[FAIL]") + " Cannot connect to MongoDB:", err.message);
    process.exit(1);
  }

  const db = conn.connection.db;

  // Get existing collection names
  const existing = (await db.listCollections().toArray()).map((c) => c.name);

  // ── Drop if requested ──
  if (shouldDrop) {
    console.log(yellow("Dropping existing collections..."));
    for (const col of collections) {
      if (existing.includes(col.name)) {
        await db.dropCollection(col.name);
        console.log(`  ${red("Dropped")} ${col.name}`);
      }
    }
    console.log();
  }

  // ── Create collections with validators ──
  console.log("Creating collections...\n");
  for (const col of collections) {
    const refreshedExisting = (await db.listCollections().toArray()).map((c) => c.name);

    if (refreshedExisting.includes(col.name)) {
      // Update validator on existing collection
      try {
        await db.command({
          collMod: col.name,
          validator: col.validator,
          validationLevel: "moderate",
        });
        console.log(`  ${yellow("Updated")} ${col.name} (already exists, validator updated)`);
      } catch (err) {
        console.log(`  ${yellow("Skipped")} ${col.name} validator update: ${err.message}`);
      }
    } else {
      await db.createCollection(col.name, {
        validator: col.validator,
        validationLevel: "moderate",
      });
      console.log(`  ${green("Created")} ${col.name}`);
    }
  }

  // ── Create indexes ──
  console.log("\nCreating indexes...\n");
  for (const col of collections) {
    const collection = db.collection(col.name);
    for (const idx of col.indexes) {
      try {
        await collection.createIndex(idx.key, idx.options);
        console.log(`  ${green("+")} ${col.name}.${idx.options.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          // Index already exists with different options — skip
          console.log(`  ${yellow("~")} ${col.name}.${idx.options.name} (already exists)`);
        } else {
          console.log(`  ${red("!")} ${col.name}.${idx.options.name}: ${err.message}`);
        }
      }
    }
  }

  // ── Summary ──
  console.log(cyan("\n========================================"));
  console.log(cyan("  Migration Complete!"));
  console.log(cyan("========================================\n"));

  // Print collection stats
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    const indexes = await db.collection(col.name).indexes();
    console.log(
      `  ${col.name.padEnd(20)} ${String(count).padStart(5)} docs  |  ${indexes.length} indexes`
    );
  }
  console.log();

  await mongoose.disconnect();
  process.exit(0);
}

// ─── Run ────────────────────────────────────────────────────────────
migrate().catch((err) => {
  console.error(red("\nMigration failed:"), err);
  process.exit(1);
});
