import express from "express";
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

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Campaign Admin API",
    message: "This is the backend API. Open the admin panel at http://localhost:5173",
    health: "/health",
    apiBase: "/api",
  });
});

// Uploaded files (logos, etc.)
app.use("/uploads", express.static(UPLOADS_DIR));

// Public self-contained survey page
app.get("/s/:slug", surveyPage);

// Tracking (open pixel, click redirect, unsubscribe)
app.use("/t", trackingRoutes);

// API
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    await ensureSystemRoles();
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
