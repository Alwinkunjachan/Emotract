import express from "express";
import {
  blockUser,
  deleteUser,
  getDashboardStats,
  getCompleteUsersDetails,
  getUserAnalytics,
  getUserDetails,
  getUserGenderDetails,
  informUserOrGuardian,
  unBlockUser
} from "../../controllers/v1/adminController.js";
import {
  completeProfile,
  auth0Webhook,
  getMe,
  getAllUsers,
  setAvatar,
  logOut,
  getUserOnlineStatus,
  getAllContactsUsers,
  getUserBlockStatus,
} from "../../controllers/v1/userController.js";
import { verifyAccessToken, resolveUser } from "../../middleware/authMiddleware.js";
import { isAdmin } from "../../middleware/isAdmin.js";

const v1AuthRoutes = express.Router();

// PUBLIC ROUTES
v1AuthRoutes.post("/auth0-webhook", auth0Webhook);

// PROTECTED USER ROUTES (Auth0 token required)
v1AuthRoutes.patch("/complete-profile", verifyAccessToken, resolveUser, completeProfile);

// PROTECTED USER ROUTES (Auth0 token required)
v1AuthRoutes.get("/me", verifyAccessToken, resolveUser, getMe);
v1AuthRoutes.get("/all-users/:id", verifyAccessToken, resolveUser, getAllUsers);
v1AuthRoutes.get("/all-contact-users/:id", verifyAccessToken, resolveUser, getAllContactsUsers);
v1AuthRoutes.post("/setavatar/:id", verifyAccessToken, resolveUser, setAvatar);
v1AuthRoutes.get("/online-status/:id", verifyAccessToken, resolveUser, getUserOnlineStatus);
v1AuthRoutes.get("/block-status/:id", verifyAccessToken, resolveUser, getUserBlockStatus);
v1AuthRoutes.post("/logout", verifyAccessToken, resolveUser, logOut);

// ADMIN ROUTES (Auth0 token + admin role required)
v1AuthRoutes.get("/dashboard-stats/", verifyAccessToken, resolveUser, isAdmin, getDashboardStats);
v1AuthRoutes.get("/complete-users/", verifyAccessToken, resolveUser, isAdmin, getCompleteUsersDetails);
v1AuthRoutes.get("/user-gender-details/", verifyAccessToken, resolveUser, isAdmin, getUserGenderDetails);
v1AuthRoutes.get("/get-user-details/:id", verifyAccessToken, resolveUser, isAdmin, getUserDetails);
v1AuthRoutes.patch("/block-user/:id", verifyAccessToken, resolveUser, isAdmin, blockUser);
v1AuthRoutes.patch("/unblock-user/:id", verifyAccessToken, resolveUser, isAdmin, unBlockUser);
v1AuthRoutes.delete("/delete-user/:id", verifyAccessToken, resolveUser, isAdmin, deleteUser);
v1AuthRoutes.get("/get-user-analytics/:id", verifyAccessToken, resolveUser, isAdmin, getUserAnalytics);
v1AuthRoutes.post("/restrict-user", verifyAccessToken, resolveUser, isAdmin, informUserOrGuardian);

export default v1AuthRoutes;
