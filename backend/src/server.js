import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { logger } from "./utils/logger.js";
import apiRoutes from "./routes/index.js";
import trackingRoutes from "./routes/tracking.route.js";
import { surveyPage } from "./controllers/publicPage.controller.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { UPLOADS_DIR } from "./middleware/upload.js";
import { resumePendingCampaigns } from "./services/queue.js";
import { startScheduler } from "./services/scheduler.js";
import { ensureSystemRoles } from "./models/Role.js";
import { User } from "./models/User.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: ENV.CORS_ORIGIN.includes("*") ? true : ENV.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(hpp());

if (ENV.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok", time: new Date().toISOString() });
});

// API info at root only when the frontend is not bundled (local dev)
const __rootDir = path.dirname(fileURLToPath(import.meta.url));
const __distDir = path.resolve(__rootDir, "../../frontend/dist");
if (!fs.existsSync(__distDir)) {
  app.get("/", (req, res) => {
    res.json({
      success: true,
      name: "Campaign Admin API",
      message: "Backend API. The admin panel runs on the Vite dev server (http://localhost:5001).",
      health: "/health",
      apiBase: "/api",
    });
  });
}

// Uploaded files (logos, etc.)
app.use("/uploads", express.static(UPLOADS_DIR));

// Public self-contained survey page
app.get("/s/:slug", surveyPage);

// Tracking (open pixel, click redirect, unsubscribe)
app.use("/t", trackingRoutes);

// API
app.use("/api", apiRoutes);

// Serve the built frontend (single-service deployment, e.g. Render).
// In local development the frontend runs on its own Vite dev server.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/t/") ||
      req.path.startsWith("/s/") ||
      req.path.startsWith("/uploads") ||
      req.path === "/health"
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

// Create the first super admin automatically (useful on hosts without a shell)
async function ensureSuperAdmin() {
  const count = await User.countDocuments({ role: "super_admin" });
  if (count === 0) {
    await User.create({
      name: ENV.SUPER_ADMIN_NAME,
      email: ENV.SUPER_ADMIN_EMAIL,
      password: ENV.SUPER_ADMIN_PASSWORD,
      role: "super_admin",
    });
    logger.info(`Created super admin: ${ENV.SUPER_ADMIN_EMAIL}`);
  }
}

async function start() {
  try {
    await connectDB();
    await ensureSystemRoles();
    await ensureSuperAdmin();
    await resumePendingCampaigns();
    startScheduler();
    app.listen(ENV.PORT, () => {
      logger.info(`Server running on http://localhost:${ENV.PORT} (${ENV.NODE_ENV})`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

start();

export default app;
