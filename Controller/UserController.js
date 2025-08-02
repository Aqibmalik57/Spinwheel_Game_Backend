import twilio from "twilio";
import UserModel from "../Modal/UserModel.js";
import Errorhandler from "../utils/ErrorHandling.js";
import dotenv from "dotenv";
import crypto from "crypto";
import { v2 } from "cloudinary";

dotenv.config();

const otpStore = {};

const twilioClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const regis = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return next(new Errorhandler("Phone and password are required", 400));
    }

    const existingUser = await UserModel.findOne({ phone });
    if (existingUser) {
      return next(new Errorhandler("User already exists", 409));
    }

    const newUser = await UserModel.create({ phone, password });
    const token = newUser.getJWTtoken();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
    });
  } catch (err) {
    next(err);
  }
};

// export const sendOtp = async (req, res, next) => {
//   const { phone, password } = req.body;

//   if (!phone || !password) {
//     return next(new Errorhandler("Phone and password are required", 400));
//   }

//   try {
//     const existingUser = await UserModel.findOne({ phone });
//     if (existingUser) {
//       return next(new Errorhandler("User already exists", 409));
//     }

//     // Send OTP via Twilio Verify Service
//     await twilioClient.verify.v2
//       .services(process.env.TWILIO_VERIFY_SERVICE_SID)
//       .verifications.create({
//         to: phone.startsWith("+") ? phone : `+92${phone}`,
//         channel: "sms",
//       });

//     otpStore[phone] = {
//       password,
//       expiresAt: Date.now() + 5 * 60 * 1000,
//     };

//     res.status(200).json({
//       success: true,
//       message: "OTP sent successfully",
//     });
//   } catch (error) {
//     console.error("Error sending OTP:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// export const verifyOtp = async (req, res, next) => {
//   const { phone, otp } = req.body;

//   const record = otpStore[phone];
//   if (!record) {
//     return next(new Errorhandler("No OTP found. Please request again.", 400));
//   }

//   if (Date.now() > record.expiresAt) {
//     delete otpStore[phone];
//     return next(new Errorhandler("OTP has expired", 400));
//   }

//   try {
//     const verificationCheck = await twilioClient.verify.v2
//       .services(process.env.TWILIO_VERIFY_SERVICE_SID)
//       .verificationChecks.create({
//         to: phone.startsWith("+") ? phone : `+92${phone}`,
//         code: otp,
//       });

//     if (verificationCheck.status !== "approved") {
//       return next(new Errorhandler("Invalid or expired OTP", 400));
//     }

//     // ✅ Register the user
//     const newUser = new UserModel({ phone, password: record.password });
//     await newUser.save();
//     const token = newUser.getJWTtoken();

//     delete otpStore[phone];

//     res
//       .status(201)
//       .cookie("token", token, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === "production",
//         maxAge: 30 * 24 * 60 * 60 * 1000,
//         sameSite: "None",
//       })
//       .json({
//         message: "User registered successfully",
//         user: newUser,
//       });
//   } catch (error) {
//     console.error("OTP verification failed:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

export const loginUser = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const user = await UserModel.findOne({ phone }).select("+password");
    if (!user) {
      return next(new Errorhandler("User not found", 404));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new Errorhandler("Invalid phone or password", 401));
    }

    const token = user.getJWTtoken();

    res
      .status(200)
      .cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      })
      .json({
        success: true,
        message: "User logged in successfully",
        user,
        token,
      });
  } catch (error) {
    next(error);
  }
};

export const Logout = async (req, res, next) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "None",
      secure: true,
    });

    res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const Myprofile = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return next(new Errorhandler("User not logged in", 400));
    }

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const ForgotPassword = async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new Errorhandler("Please enter a valid phone number", 400));
  }

  const user = await UserModel.findOne({ phone });
  if (!user) {
    return next(new Errorhandler("No account with this phone number", 404));
  }

  try {
    await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: phone.startsWith("+") ? phone : `+92${phone}`,
        channel: "sms",
      });

    res.status(200).json({
      success: true,
      message: `OTP sent to ${phone} for password reset`,
    });
  } catch (err) {
    console.error("Twilio Verify Send Error:", err.message);
    return next(new Errorhandler("Failed to send OTP", 500));
  }
};

export const VerifyResetOtp = async (req, res, next) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return next(new Errorhandler("Phone and OTP are required", 400));
  }

  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phone.startsWith("+") ? phone : `+92${phone}`,
        code: otp,
      });

    if (verificationCheck.status !== "approved") {
      return next(new Errorhandler("Invalid or expired OTP", 400));
    }

    const user = await UserModel.findOne({ phone });
    if (!user) {
      return next(new Errorhandler("User not found", 404));
    }

    const rawToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "OTP verified, use this token to reset password",
      resetToken: rawToken,
    });
  } catch (error) {
    console.error("OTP verification failed:", error.message);
    return next(new Errorhandler("Failed to verify OTP", 500));
  }
};

export const ResetPassword = async (req, res, next) => {
  const token = req.params.token;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await UserModel.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new Errorhandler("Invalid or expired reset password token", 400)
    );
  }

  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword || newPassword !== confirmPassword) {
    return next(new Errorhandler("Passwords do not match or are missing", 400));
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successfully",
  });
};

export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;

    // If image uploaded, convert to base64 and send to Cloudinary
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      const cloudinaryRes = await v2.uploader.upload(dataURI, {
        folder: "Game_profile_pics",
      });

      updateFields.profilePicture = cloudinaryRes.secure_url;
    }

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update" });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
