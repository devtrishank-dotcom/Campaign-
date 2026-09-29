import dotenv from "dotenv";

dotenv.config();

const required = ["MONGO_URI", "JWT_SECRET", "SETTINGS_ENCRYPTION_KEY"];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`[env] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

export const ENV = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || "development",
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || "http://localhost:5000").replace(/\/+$/, ""),
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  SETTINGS_ENCRYPTION_KEY: process.env.SETTINGS_ENCRYPTION_KEY,
  CORS_ORIGIN: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME || "Super Admin",
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || "Admin@12345",
};
