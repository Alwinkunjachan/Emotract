import Users from "../../models/Users.js";
import Chats from "../../models/Chats.js";

// Complete profile for auto-provisioned users (first login via Auth0)
export const completeProfile = async (req, res, next) => {
  try {
    const { firstname, lastname, phone, aadhaar_number, parent_email, age, gender } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!firstname || !lastname || !phone || !aadhaar_number || !parent_email || !age || !gender) {
      return res.status(400).json({ message: "All fields are required", status: false });
    }

    // Validate aadhaar format
    const aadhaarRegex = /^[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}$/;
    if (!aadhaarRegex.test(aadhaar_number)) {
      return res.status(400).json({ message: "Invalid Aadhaar number format", status: false });
    }

    // Validate phone (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: "Phone must be 10 digits", status: false });
    }

    // Check phone and aadhaar uniqueness (excluding current user)
    const existing = await Users.findOne({
      _id: { $ne: userId },
      $or: [{ phone }, { aadhaar_number }],
    });

    if (existing) {
      const msg = existing.phone === phone ? "Phone number already used" : "Aadhaar number already used";
      return res.status(409).json({ message: msg, status: false });
    }

    const parsedAge = parseInt(age);
    const ageVerified = parsedAge >= 18;

    const user = await Users.findByIdAndUpdate(
      userId,
      {
        firstname,
        lastname,
        phone,
        aadhaar_number,
        parent_email,
        age: parsedAge,
        gender,
        age_verified: ageVerified,
        is_profile_complete: true,
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found", status: false });
    }

    return res.json({ status: true, user });
  } catch (error) {
    next(error);
  }
};

// Auth0 Post User Registration webhook
// Called by Auth0 Action whenever a new user signs up through Auth0 Universal Login
export const auth0Webhook = async (req, res) => {
  try {
    const webhookSecret = process.env.AUTH0_WEBHOOK_SECRET;
    if (webhookSecret && req.headers["x-auth0-webhook-secret"] !== webhookSecret) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { auth0_id, email, username, firstname, lastname } = req.body;

    if (!auth0_id || !email) {
      return res.status(400).json({ message: "auth0_id and email are required" });
    }

    // Check if user already exists
    const existingUser = await Users.findOne({ auth0_id });
    if (existingUser) {
      return res.status(200).json({ message: "User already exists", user_id: existingUser._id });
    }

    const user = await Users.create({
      auth0_id,
      email,
      username: username || email.split("@")[0],
      firstname: firstname || "User",
      lastname: lastname || "",
      age: 18,
      phone: "0000000000",
      gender: "M",
      role: "USER",
      is_active: true,
    });

    console.log(`Webhook: Created local user for Auth0 ID ${auth0_id}`);
    return res.status(201).json({ message: "User created", user_id: user._id });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Returns the authenticated user's full profile
export const getMe = async (req, res, next) => {
  try {
    const user = await Users.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ status: true, user });
  } catch (error) {
    next(error);
  }
};

// Get all users except current user
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await Users.find({
      _id: { $ne: req.params.id },
      is_active: true,
      is_profile_complete: true,
    }).select("email username avatarImage _id");

    return res.json(users);
  } catch (ex) {
    next(ex);
  }
};

// Get all contact users
export const getAllContactsUsers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const chats = await Chats.find({ participants: id, is_active: true })
      .populate("participants", "username avatarImage email _id last_active")
      .lean();

    const contacts = [];
    const addedUserIds = new Set();

    chats.forEach((chat) => {
      chat.participants.forEach((participant) => {
        if (participant._id.toString() !== id && !addedUserIds.has(participant._id.toString())) {
          contacts.push({
            _id: participant._id,
            username: participant.username,
            avatarImage: participant.avatarImage,
            email: participant.email,
            last_active: participant.last_active,
            lastMessage: chat.last_message
              ? {
                  text: chat.last_message.text || "",
                  sender: chat.last_message.sender_id.toString() === id ? "You" : "Them",
                  sentAt: chat.last_message.sent_at || null,
                }
              : null,
          });
          addedUserIds.add(participant._id.toString());
        }
      });
    });

    return res.json(contacts);
  } catch (ex) {
    console.error(ex);
    next(new Error("Internal server error while fetching contacts"));
  }
};

export const setAvatar = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const avatarImage = req.body.image;

    const userData = await Users.findByIdAndUpdate(
      userId,
      {
        isAvatarImageSet: true,
        avatarImage,
      },
      { new: true }
    );

    return res.json({
      isSet: userData.isAvatarImageSet,
      image: userData.avatarImage,
    });
  } catch (ex) {
    next(ex);
  }
};

export const getUserOnlineStatus = async (req, res) => {
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ is_online: user.is_online });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserBlockStatus = async (req, res) => {
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ is_blocked: user.is_flagged });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const logOut = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Remove from onlineUsers map
    if (global.onlineUsers && global.onlineUsers.has(userId)) {
      global.onlineUsers.delete(userId);
    }

    // Update user status in DB
    await Users.findByIdAndUpdate(userId, {
      is_online: false,
      socket_id: null,
      last_active: new Date(),
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Error during logout:", err);
    res.status(500).json({ message: "Server error during logout" });
  }
};
