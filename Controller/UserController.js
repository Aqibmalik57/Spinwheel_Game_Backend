import UserModel from "../Modal/UserModel.js";
import Errorhandler from "../utils/ErrorHandling.js";
import dotenv from "dotenv";
import crypto from "crypto";
import { v2 } from "cloudinary";
import nodemailer from "nodemailer";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 📌 Register User (with welcome email)
export const registerUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new Errorhandler("Email and password are required", 400));
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return next(new Errorhandler("User already exists", 409));
    }

    // create new user (other fields will use default values from schema)
    const user = await UserModel.create({
      email,
      password,
    });

    // send welcome mail
    await transporter.sendMail({
      from: `"Game1pro Support" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "🚀 Welcome to Game1pro – Your Adventure Begins!",
      html: `
  <div style="font-family: Arial, sans-serif; background: #f4f7fb; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg,#3498db,#2c3e50); color: #fff; padding: 25px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">🎮 Welcome to Game1pro, ${
          user.name
        }!</h1>
      </div>

      <!-- Body -->
      <div style="padding: 25px; color: #333;">
        <p style="font-size: 16px; line-height: 1.6;">
          We're thrilled to have you join the <strong>Game1pro Community</strong>!  
          Your account has been created successfully and you're ready to start exploring exclusive features.
        </p>

        <h3 style="color: #3498db; margin-top: 20px;">✨ What’s next?</h3>
        <ul style="padding-left: 20px; line-height: 1.6; font-size: 15px;">
          <li>✅ <strong>Login</strong> and explore your personal dashboard.</li>
          <li>🎯 Earn rewards and track your progress in real-time.</li>
          <li>🚀 Be the first to enjoy upcoming updates and features.</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://game1pro.com/" 
             style="display: inline-block; background: #3498db; color: #fff; padding: 14px 28px; font-size: 16px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            🔑 Login to Your Account
          </a>
        </div>

        <p style="font-size: 15px; color: #555; text-align: center; line-height: 1.6;">
          Need help? Our support team is always here for you – just reply to this email.  
          <br><br>
          Let’s make this an awesome journey together! 🎉
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f0f3f8; padding: 15px; text-align: center; font-size: 12px; color: #888;">
        © ${new Date().getFullYear()} Game1pro. All rights reserved.  
      </div>
    </div>
  </div>
  `,
    });

    const token = user.getJWTtoken();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
      token,
    });
  } catch (error) {
    console.error("Register Error:", error);
    next(error);
  }
};

// 📌 Login with email + password
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return next(new Errorhandler("Email and password required", 400));

    const user = await UserModel.findOne({ email }).select("+password");
    if (!user) {
      return next(new Errorhandler("User not found", 404));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new Errorhandler("Invalid email or password", 401));
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

// 📌 Logout
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

// 📌 My Profile
export const Myprofile = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return next(new Errorhandler("User not logged in", 400));
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// 📌 Forgot Password (send email with reset link)
export const ForgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new Errorhandler("Please enter your email", 400));
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return next(new Errorhandler("No account with this email", 404));
  }

  try {
    const rawToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${req.protocol}://game1pro.com/reset-password/${rawToken}`;

    await transporter.sendMail({
      from: `"Game1pro Support" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "🔐 Password Reset Request - Game1pro",
      html: `
    <div style="background-color:#f4f4f7; padding:40px 0; font-family: Arial, sans-serif; color:#333;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background:#2c3e50; padding:20px; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:22px;">Game1pro Security</h1>
        </div>
        
        <!-- Body -->
        <div style="padding:30px;">
          <h2 style="color:#2c3e50; font-size:20px; margin-bottom:20px;">Password Reset Requested</h2>
          <p style="font-size:15px; line-height:1.6;">
            Hello <strong>${user.name || "User"}</strong>,
          </p>
          <p style="font-size:15px; line-height:1.6; margin-bottom:25px;">
            We received a request to reset your Game1pro account password. If this was you, click the button below to securely reset your password.
          </p>
          
          <!-- Button -->
          <div style="text-align:center; margin:30px 0;">
            <a href="${resetUrl}" 
               style="background:#3498db; color:#ffffff; padding:14px 28px; font-size:16px; text-decoration:none; font-weight:bold; border-radius:6px; display:inline-block;">
              🔒 Reset My Password
            </a>
          </div>
          
          <p style="font-size:14px; color:#555; line-height:1.5;">
            This reset link will expire in <strong>15 minutes</strong> for your security. If you didn’t request a password reset, you can safely ignore this email—your password will remain unchanged.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background:#f0f0f0; padding:15px; text-align:center; font-size:12px; color:#888;">
          <p style="margin:0;">© ${new Date().getFullYear()} Game1pro. All rights reserved.</p>
        </div>
        
      </div>
    </div>
  `,
    });

    res.status(200).json({
      success: true,
      message: `Password reset link sent to ${user.email}`,
    });
  } catch (err) {
    console.error("ForgotPassword Error:", err.message);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new Errorhandler("Failed to send reset email", 500));
  }
};

// 📌 Reset Password
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

// 📌 Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;

    // If image uploaded, convert to base64 and send to Cloudinary
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      const cloudinaryRes = await v2.uploader.upload(dataURI, {
        folder: "User_profile_pics",
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
