import express from "express";
import {
  registerUser,
  loginUser,
  Logout,
  Myprofile,
  ForgotPassword,
  ResetPassword,
  updateProfile,
} from "../Controller/UserController.js";
import { isUserLoggedin } from "../utils/Auth.js";
import upload from "../utils/multer.js";

const router = express.Router();

// ✅ Register
router.post("/register", registerUser);

// ✅ Login
router.post("/login", loginUser);

// ✅ Logout
router.post("/logout", Logout);

// ✅ My Profile (protected)
router.get("/profile", isUserLoggedin, Myprofile);

// ✅ Update Profile (with image upload)
router.put(
  "/update-profile/:id",
  isUserLoggedin,
  upload.single("file"),
  updateProfile
);

// ✅ Forgot Password
router.post("/forgot-password", ForgotPassword);

// ✅ Reset Password
router.post("/reset-password/:token", ResetPassword);

export default router;
