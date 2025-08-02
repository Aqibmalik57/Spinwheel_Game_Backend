import express from "express";
import {
  ForgotPassword,
  loginUser,
  Logout,
  Myprofile,
  regis,
  ResetPassword,
  updateProfile,
  // sendOtp,
  // verifyOtp,
  VerifyResetOtp,
} from "../Controller/UserController.js";
import { isUserLoggedin } from "../utils/Auth.js";
import upload from "../utils/multer.js";

const router = express.Router();

router.post("/regis", regis);
// router.post("/send-otp", sendOtp);
// router.post("/verify-otp", verifyOtp);
router.post("/loginUser", loginUser);
router.get("/profile", isUserLoggedin, Myprofile);
router.put(
  "/updateProfile/:id",
  isUserLoggedin,
  upload.single("file"),
  updateProfile
);
router.post("/logout", Logout);
router.post("/forgotpassword", ForgotPassword);
router.post("/verify-reset-otp", VerifyResetOtp);
router.post("/resetpassword/:token", ResetPassword);

export default router;
