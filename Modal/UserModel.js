import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const Userschema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
    },
    name: { type: String, default: "New User" },
    email: {
      type: String,
      unique: true,
      required: [true, "Please enter your email"],
      validate: [validator.isEmail, "Please enter a valid email"],
    },
    coins: {
      earned: { type: Number, default: 100 },
      purchased: { type: Number, default: 0 },
      Withdrawable: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    password: {
      type: String,
      required: true,
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    phone: {
      type: String,
      minlength: [11, "Phone number must be at least 11 characters long"],
      unique: false, // ✅ ensures no unique index is created
      sparse: true, // ✅ allows multiple nulls
    },

    address: { type: String, default: null },
    isAdmin: { type: Boolean, default: false },
    profilePicture: { type: String, default: null },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);
Userschema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  if (!this.userId) {
    let unique = false;
    while (!unique) {
      const id = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8-digit random
      const existing = await mongoose.models.User.findOne({ userId: id });
      if (!existing) {
        this.userId = id;
        unique = true;
      }
    }
  }

  const earned = this.coins?.earned ?? 0;
  const purchased = this.coins?.purchased ?? 0;
  const total = earned + purchased;

  this.coins.total = total;
  this.coins.Withdrawable = Math.floor(total * 0.5);

  next();
});

// 🔐 Methods
Userschema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

Userschema.methods.getJWTtoken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

Userschema.methods.getResetPasswordToken = function () {
  const rawToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
  return rawToken;
};

export default mongoose.model("User", Userschema);
