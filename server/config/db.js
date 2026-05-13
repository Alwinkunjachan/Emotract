// /config/db.js
import mongoose from "mongoose";
import { createDefaultAdmin } from "./admin.js";
import { isDocker } from "./runtime.js";

const connectDB = async () => {
  try {
    let mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/chat";
    if (!isDocker) {
      mongoUrl = mongoUrl.replace("//mongo:", "//localhost:");
    }
    await mongoose.connect(mongoUrl);
    await createDefaultAdmin();
    console.log("DB Connection Successful");
  } catch (err) {
    console.error("DB Connection Unsuccessful", err.message);
    process.exit(1); // Exit the process if DB connection fails
  }
};

export default connectDB;
