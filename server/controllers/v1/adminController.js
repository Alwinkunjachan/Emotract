import mongoose from 'mongoose';
import Users from "../../models/Users.js";
import Chats from '../../models/Chats.js';
import Messages from '../../models/Messages.js';
import { sendParentEmail, warnUsersendEmail } from '../../utils/sendEmail.js';


// get dashboard stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await Users.countDocuments({ is_active: true, role: "USER" });
    const onlineUsers = await Users.countDocuments({ is_active: true, role: "USER", is_online: true });
    const flaggedUsers = await Users.countDocuments({ is_active: true, role: "USER", is_flagged: true });
    const totalMessages = await Messages.countDocuments({ is_active: true });
    const flaggedMessages = await Messages.countDocuments({ is_active: true, is_flagged: true });
    const totalChats = await Chats.countDocuments({ is_active: true });

    // Message trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const messageTrend = await Messages.aggregate([
      { $match: { is_active: true, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
          flagged: { $sum: { $cond: ["$is_flagged", 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // User registration trend (last 30 days)
    const registrationTrend = await Users.aggregate([
      { $match: { is_active: true, role: "USER", created_at: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      totalUsers,
      onlineUsers,
      flaggedUsers,
      totalMessages,
      flaggedMessages,
      totalChats,
      messageTrend,
      registrationTrend,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// get all users
export const getCompleteUsersDetails = async (req, res, next) => {
  try {
    const users = await Users.find({ is_active: true, role: "USER" })
    .select(
      "email username avatarImage _id age firstname lastname phone imageUrl age_verified is_flagged flag_count last_active parent_email"
    );

    if (!users) return res.status(500).json({ message: "User not found" });

    const limit = parseInt(req.query.limit) || users.length;

    return res.json(users.slice(0, limit)).status(200);
  } catch (ex) {
    next(ex);
  }
};

// get single user details  
export const getUserDetails = async (req, res, next) => {
  try {
    const user = await Users.find({ is_active: true, role: "USER", _id: req.params.id })
    .select(
      "email username avatarImage _id age firstname lastname phone imageUrl age_verified is_flagged flag_count last_active parent_email is_online"
    );

    if (!user) return res.status(500).json({ message: "User not found" });

    return res.json(user[0]).status(200);
  } catch (ex) {
    next(ex);
  }
};

// Block user 
export const blockUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const updatedUser = await Users.findByIdAndUpdate(
      userId,
      {
        is_flagged: true
      }
    )

    if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

    return res.status(200).json({ status: true, messsage: "User successfully blocked" });
  } catch (ex) {
    res.status(500).json({ status: false, message: ex });
    next(ex);
  }
};

// Unblock user 
export const unBlockUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const updatedUser = await Users.findByIdAndUpdate(
      userId,
      {
        is_flagged: false
      }
    )

    if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

    return res.status(200).json({ status: true, messsage: "User successfully unblocked" });
  } catch (ex) {
    res.status(500).json({ status: false, message: ex });
    next(ex);
  }
};

// Delete a  user (soft delete) 
export const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const updatedUser = await Users.findByIdAndUpdate(
      userId,
      {
        is_active: false
      }
    )

    if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

    return res.status(200).json({ status: true, messsage: "User deleted" });
  } catch (ex) {
    res.status(500).json({ status: false, message: ex });
    next(ex);
  }
};

// get user analytics
export const getUserAnalytics = async (req, res) => {
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const user = await Users.findById(userId).select(
      'username email last_active created_at flag_count is_flagged role firstname lastname email parent_email is_online avatarImage age phone'
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const chatCount = await Chats.countDocuments({
      participants: userId,
      is_active: true,
    });

    const messageStats = await Messages.aggregate([
      { $match: { sender_id: new mongoose.Types.ObjectId(userId), is_active: true } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          flaggedMessages: { $sum: { $cond: ['$is_flagged', 1, 0] } },
        },
      },
    ]);

    const totalMessages = messageStats[0]?.totalMessages || 0;
    const flaggedMessages = messageStats[0]?.flaggedMessages || 0;

    const messageTrend = await Messages.aggregate([
      { $match: { sender_id: new mongoose.Types.ObjectId(userId), is_active: true } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$sent_at" } },
          total: { $sum: 1 },
          flagged: { $sum: { $cond: ['$is_flagged', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const analytics = {
      user: {
        id: user._id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        parent_email: user.parent_email,
        is_online: user.is_online,
        avatarImage: user.avatarImage,
        age: user.age,
        phone: user.phone,
        email: user.email,
        role: user.role,
        lastActive: user.last_active,
        createdAt: user.created_at,
        flagCount: user.flag_count,
        is_flagged: user.is_flagged,
      },
      chats: {
        total: chatCount,
      },
      messages: {
        total: totalMessages,
        flagged: flaggedMessages,
      },
      messageTrend,
    };

    return res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return res.status(500).json({ message: "Server error" });
  }
};

// notify user or guardian 
// Example usage
// block user from frontend
// type: INFORM_PARENT | WARN_CHILD
export const informUserOrGuardian = async (req, res) => {
  const { type, email, child_name, parent_email, id } = req.body;

  try {
    // Validate required fields
    if (!type || (!email && !parent_email) || !id) {
      return res.status(400).json({ message: "Missing required fields: type, email/parent_email, and id" });
    }

    if (type === "INFORM_PARENT_AND_BLOCK") {
       // Block user and Send inform parent
      const updatedUser = await Users.findByIdAndUpdate(
        id,
        { is_flagged: true },
        { new: true }
      );
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await sendParentEmail(parent_email, "NOTIFY_PARENT_BLOCK", { childName: child_name });
    } else if (type === "WARN_CHILD") {
      // Send warning email to the user (child)
      await warnUsersendEmail(email, "USER_WARN_BLOCK", { childName: child_name });
    } else {
      return res.status(400).json({ message: "Invalid type specified" });
    }

    return res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
export const getUserGenderDetails = async (req, res) => {
  try {
    // Fetch the earliest and latest registration dates
    const firstUser = await Users.findOne({ is_active: true }).sort({ createdAt: 1 });
    const lastUser = await Users.findOne({ is_active: true }).sort({ createdAt: -1 });

    if (!firstUser || !lastUser) {
      return res.status(404).json({
        success: false,
        message: "No active users found."
      });
    }

    // The range from the first registered user to the last registered user
    const startDate = firstUser.createdAt;
    const referenceDate = lastUser.createdAt;

    const genderStats = await Users.aggregate([
      {
        $match: {
          is_active: true,
          createdAt: { $gte: startDate, $lte: referenceDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            gender: "$gender"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          genders: {
            $push: {
              k: "$_id.gender",  // key (gender)
              v: "$count"        // value (count)
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          genderCounts: {
            $arrayToObject: "$genders"  // Ensure correct structure here
          }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    // Format the result to make sure M/F/O are always present
    const formattedStats = genderStats.map((item) => ({
      date: item.date,
      M: item.genderCounts.M || 0,
      F: item.genderCounts.F || 0,
      O: item.genderCounts.O || 0,
    }));

    return res.status(200).json({
      success: true,
      data: formattedStats
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong!"
    });
  } 
};
