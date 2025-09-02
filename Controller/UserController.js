import UserModel from "../Modal/UserModel.js";
import Errorhandler from "../utils/ErrorHandling.js";
import dotenv from "dotenv";
import crypto from "crypto";
import { v2 } from "cloudinary";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";

dotenv.config();

export const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const googleLogin = async (req, res, next) => {
  const { code } = req.body;
  if (!code) {
    return next(new Errorhandler("Authorization code is required", 400));
  }

  try {
    // 1. Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    if (!tokens.id_token) {
      return next(new Errorhandler("Missing ID token", 400));
    }

    // 2. Verify ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    if (!email || !name || !googleId) {
      return next(new Errorhandler("Invalid Google user data", 400));
    }

    // 3. Find or create user
    let user = await UserModel.findOne({ email });
    let isNewUser = false;

    if (!user) {
      user = await UserModel.create({ name, email, googleId });
      isNewUser = true;

      // 🎉 Send Welcome Mail only for new users
      await transporter.sendMail({
        from: `"Game1pro" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "🎮 Welcome to Game1Pro – Let's Start Winning!",
        html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Game1Pro</title>
  </head>
  <body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#0f172a; color:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a; padding:0; margin:0;">
      <tr>
        <td align="center">
          <!-- Main Container -->
          <table width="650" cellpadding="0" cellspacing="0" style="background:#1e293b; border-radius:12px; overflow:hidden; margin:40px auto; box-shadow:0px 4px 18px rgba(0,0,0,0.4);">
            
            <!-- Header Banner -->
            <tr>
              <td style="background:linear-gradient(90deg,#6366f1,#3b82f6); padding:40px; text-align:center;">
                <h1 style="margin:0; font-size:32px; color:#fff; letter-spacing:1px;">🎮 Welcome to <strong>Game1Pro</strong></h1>
                <p style="margin:10px 0 0; font-size:16px; color:#f1f5f9;">
                  Hey ${
                    user.name || "Player"
                  }, your journey to high winning games starts now!
                </p>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding:30px; text-align:center; color:#cbd5e1; font-size:16px; line-height:26px;">
                <p>We’re thrilled to have you join <strong>Game1Pro</strong>!  
                Get ready to dive into a world of exciting challenges,  
                high winning games, and endless fun.</p>
                <p>🎯 It’s time to test your luck and claim your rewards!</p>
              </td>
            </tr>
            
            <!-- CTA Button -->
            <tr>
              <td align="center" style="padding:20px 0;">
                <a href="https://game1pro.com" 
                   style="background:linear-gradient(90deg,#6366f1,#3b82f6); padding:14px 40px; text-decoration:none; color:#fff; font-size:18px; font-weight:bold; border-radius:40px; display:inline-block;">
                  ▶ Start Playing Now
                </a>
              </td>
            </tr>
            
            <!-- Support -->
            <tr>
              <td style="padding:30px; text-align:center; color:#94a3b8; font-size:14px; line-height:22px;">
                <p>Need help with withdrawals or purchases?</p>
                <p>📧 Email us anytime at  
                  <a href="mailto:info@game1pro.com" style="color:#60a5fa; text-decoration:none; font-weight:bold;">info@game1pro.com</a>
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background:#0f172a; text-align:center; padding:20px; font-size:12px; color:#64748b;">
                © ${new Date().getFullYear()} Game1Pro • All Rights Reserved
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
      });
    }

    // 4. Generate JWT for your app
    const jwtToken = user.getJWTtoken();

    // 5. Send response + cookie
    res
      .status(200)
      .cookie("token", jwtToken, {
        expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
      })
      .json({
        success: true,
        message: isNewUser
          ? "Google signup successful"
          : "Google login successful",
        user,
        token: jwtToken,
      });
  } catch (error) {
    console.error("🚨 Google login error:", error);
    return next(new Errorhandler("Failed to login with Google", 500));
  }
};

// 📌 Register User (with welcome email)
export const registerUser = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return next(
        new Errorhandler("Email, username and password are required", 400)
      );
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return next(new Errorhandler("User already exists", 409));
    }

    const user = await UserModel.create({
      email,
      name: username,
      password,
    });

    // send welcome mail
    await transporter.sendMail({
      from: `"Game1pro" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "🎮 Welcome to Game1Pro – Let's Start Winning!",
      html: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Game1Pro</title>
  </head>
  <body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#0f172a; color:#ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a; padding:0; margin:0;">
      <tr>
        <td align="center">
          <!-- Main Container -->
          <table width="650" cellpadding="0" cellspacing="0" style="background:#1e293b; border-radius:12px; overflow:hidden; margin:40px auto; box-shadow:0px 4px 18px rgba(0,0,0,0.4);">
            
            <!-- Header Banner -->
            <tr>
              <td style="background:linear-gradient(90deg,#6366f1,#3b82f6); padding:40px; text-align:center;">
                <h1 style="margin:0; font-size:32px; color:#fff; letter-spacing:1px;">🎮 Welcome to <strong>Game1Pro</strong></h1>
                <p style="margin:10px 0 0; font-size:16px; color:#f1f5f9;">
                  Hey ${
                    user.name || "Player"
                  }, your journey to high winning games starts now!
                </p>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding:30px; text-align:center; color:#cbd5e1; font-size:16px; line-height:26px;">
                <p>We’re thrilled to have you join <strong>Game1Pro</strong>!  
                Get ready to dive into a world of exciting challenges,  
                high winning games, and endless fun.</p>
                <p>🎯 It’s time to test your luck and claim your rewards!</p>
              </td>
            </tr>
            
            <!-- CTA Button -->
            <tr>
              <td align="center" style="padding:20px 0;">
                <a href="https://game1pro.com" 
                   style="background:linear-gradient(90deg,#6366f1,#3b82f6); padding:14px 40px; text-decoration:none; color:#fff; font-size:18px; font-weight:bold; border-radius:40px; display:inline-block;">
                  ▶ Start Playing Now
                </a>
              </td>
            </tr>
            
            <!-- Support -->
            <tr>
              <td style="padding:30px; text-align:center; color:#94a3b8; font-size:14px; line-height:22px;">
                <p>Need help with withdrawals or purchases?</p>
                <p>📧 Email us anytime at  
                  <a href="mailto:info@game1pro.com" style="color:#60a5fa; text-decoration:none; font-weight:bold;">info@game1pro.com</a>
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background:#0f172a; text-align:center; padding:20px; font-size:12px; color:#64748b;">
                © ${new Date().getFullYear()} Game1Pro • All Rights Reserved
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
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
