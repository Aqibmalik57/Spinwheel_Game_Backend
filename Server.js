import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import MDB from "./ConnectDB/ConnectionDb.js";
import UserRoutes from "./Route/UserRoutes.js";
import Error from "./Middleware/Error.js";
import { v2 } from "cloudinary";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

v2.config({
  cloud_name: process.env.Cloud_Name,
  api_key: process.env.Cloud_API_Key,
  api_secret: process.env.API_Secret_Key,
});

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "https://spin-wheel-game-one.vercel.app",
      "https://game1pro.com",
    ],
    credentials: true,
  })
);

app.use("/api/v1", UserRoutes);

// Test route
app.get("/api/v1/test", (req, res) => {
  res.json({ message: "✅ Backend API is running!" });
});

// ---------------- SPA / React Build Setup ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback: serve index.html for all non-API GET requests
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.use(Error);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  MDB();
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  server.close(() => {
    process.exit(1);
  });
});
