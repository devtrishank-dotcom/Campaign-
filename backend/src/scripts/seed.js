import mongoose from "mongoose";
import { ENV } from "../config/env.js";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { ensureSystemRoles } from "../models/Role.js";
import { logger } from "../utils/logger.js";

async function seed() {
  await connectDB();
  await ensureSystemRoles();
  logger.info("System roles ensured");

  const existing = await User.findOne({ email: ENV.SUPER_ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    logger.info(`Super admin already exists: ${existing.email}`);
  } else {
    const admin = await User.create({
      name: ENV.SUPER_ADMIN_NAME,
      email: ENV.SUPER_ADMIN_EMAIL,
      password: ENV.SUPER_ADMIN_PASSWORD,
      role: "super_admin",
      isActive: true,
    });
    logger.info(`Created super admin: ${admin.email} (password: ${ENV.SUPER_ADMIN_PASSWORD})`);
  }

  await mongoose.disconnect();
  logger.info("Seed complete");
  process.exit(0);
}

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
