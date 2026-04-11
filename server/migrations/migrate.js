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
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/chat";

const args = process.argv.slice(2);
const shouldSeed = args.includes("--seed");
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
        required: ["username", "email", "password", "firstname", "lastname", "age", "phone"],
        properties: {
          username: { bsonType: "string", minLength: 3, maxLength: 20 },
          email: { bsonType: "string" },
          password: { bsonType: "string", minLength: 8 },
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
      { key: { phone: 1 }, options: { unique: true, name: "idx_users_phone" } },
      { key: { aadhaar_number: 1 }, options: { unique: true, sparse: true, name: "idx_users_aadhaar" } },
      { key: { role: 1 }, options: { name: "idx_users_role" } },
      { key: { is_active: 1 }, options: { name: "idx_users_active" } },
      { key: { is_flagged: 1 }, options: { name: "idx_users_flagged" } },
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
  {
    name: "passwordresets",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "token", "expiresAt"],
        properties: {
          userId: { bsonType: "objectId" },
          token: { bsonType: "string" },
          expiresAt: { bsonType: "date" },
        },
      },
    },
    indexes: [
      { key: { userId: 1 }, options: { name: "idx_pwdreset_user" } },
      { key: { token: 1 }, options: { unique: true, name: "idx_pwdreset_token" } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0, name: "idx_pwdreset_ttl" } },
    ],
  },
];

// ─── Migration Runner ───────────────────────────────────────────────
async function migrate() {
  console.log(cyan("\n========================================"));
  console.log(cyan("  MERN-NLP-Emotract Database Migration"));
  console.log(cyan("========================================\n"));
  console.log(`  MongoDB URL: ${yellow(MONGO_URL)}`);
  console.log(`  Seed data:   ${shouldSeed ? green("Yes") : "No"}`);
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

  // ── Seed default admin ──
  console.log("\nSeeding default admin...\n");
  await seedAdmin(db);

  // ── Seed sample data ──
  if (shouldSeed) {
    console.log("\nSeeding sample data...\n");
    await seedSampleData(db);
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

// ─── Seed: Default Admin ────────────────────────────────────────────
async function seedAdmin(db) {
  const usersCol = db.collection("users");

  const adminExists = await usersCol.findOne({ role: "ADMIN" });
  if (adminExists) {
    console.log(`  ${yellow("Skipped")} Admin already exists (${adminExists.username})`);
    return;
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;
  const phone = process.env.ADMIN_PHONE || "9999999999";

  if (!username || !password || !email) {
    console.log(
      `  ${red("Skipped")} Admin creation — set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL in .env`
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await usersCol.insertOne({
    username,
    email,
    password: hashedPassword,
    firstname: "Super",
    lastname: "Admin",
    age: 30,
    gender: "M",
    phone,
    role: "ADMIN",
    is_active: true,
    is_online: false,
    is_flagged: false,
    flag_count: 0,
    isAvatarImageSet: false,
    avatarImage: "",
    imageUrl: "",
    device_id: "NA",
    clerk_id: "NA",
    socket_id: null,
    age_verified: true,
    last_active: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`  ${green("Created")} Default admin: ${username}`);
}

// ─── Seed: Sample Data (optional) ───────────────────────────────────
async function seedSampleData(db) {
  const usersCol = db.collection("users");

  const sampleUsers = [
    {
      username: "john_doe",
      email: "john@example.com",
      firstname: "John",
      lastname: "Doe",
      age: 22,
      gender: "M",
      phone: "9876543210",
      aadhaar_number: "2345 6789 0123",
    },
    {
      username: "jane_smith",
      email: "jane@example.com",
      firstname: "Jane",
      lastname: "Smith",
      age: 20,
      gender: "F",
      phone: "9876543211",
      aadhaar_number: "3456 7890 1234",
    },
    {
      username: "alex_kumar",
      email: "alex@example.com",
      firstname: "Alex",
      lastname: "Kumar",
      age: 25,
      gender: "M",
      phone: "9876543212",
      aadhaar_number: "4567 8901 2345",
    },
  ];

  const hashedPassword = await bcrypt.hash("password123", 10);

  for (const user of sampleUsers) {
    const exists = await usersCol.findOne({ username: user.username });
    if (exists) {
      console.log(`  ${yellow("Skipped")} ${user.username} (already exists)`);
      continue;
    }

    await usersCol.insertOne({
      ...user,
      password: hashedPassword,
      role: "USER",
      is_active: true,
      is_online: false,
      is_flagged: false,
      flag_count: 0,
      isAvatarImageSet: false,
      avatarImage: "",
      imageUrl: "",
      device_id: "NA",
      clerk_id: "NA",
      socket_id: null,
      age_verified: user.age >= 18,
      parent_email: "",
      aadhaar_number: user.aadhaar_number,
      last_active: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log(`  ${green("Created")} Sample user: ${user.username}`);
  }
}

// ─── Run ────────────────────────────────────────────────────────────
migrate().catch((err) => {
  console.error(red("\nMigration failed:"), err);
  process.exit(1);
});
