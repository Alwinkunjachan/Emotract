import mongoose from "mongoose";

const usersSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      min: 3,
      max: 20,
      unique: true,
    },
    auth0_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    device_id: {
      type: String,
      required: false,
      default: "NA",
    },
    socket_id: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      max: 50,
    },
    password: {
      type: String,
      required: false,
      min: 8,
    },
    aadhaar_number: {
      type: String,
    },
    firstname: {
      type: String,
      required: false,
      default: "",
    },
    lastname: {
      type: String,
      required: false,
      default: "",
    },
    parent_email: {
      type: String,
      required: false,
    },
    age: {
      type: Number,
      required: false,
      default: 0,
    },
    gender: {
      type: String,
      default: "M",
      enum: ["M", "F", "O"]
    },
    phone: {
      type: String,
      required: false,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    age_verified: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_online: {
      type: Boolean,
      default: false,
    },
    is_flagged: {
      type: Boolean,
      default: false,
    },
    flag_count: {
      type: Number,
      default: 0,
    },
    last_active: {
      type: Date,
      default: Date.now,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    isAvatarImageSet: {
      type: Boolean,
      default: false,
    },
    avatarImage: {
      type: String,
      default: "",
    },
    is_profile_complete: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      default: "USER",
      enum: ["USER", "ADMIN"],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export default mongoose.model("Users", usersSchema);
