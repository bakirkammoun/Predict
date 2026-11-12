import bcrypt from "bcryptjs";
import { disconnectDb, connectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

const demoUsers = [
  {
    oldEmail: "tech@predimaint.local",
    email: "tech@gmail.com",
    firstName: "Nacir",
    lastName: "Mahfoudhi",
  },
  {
    oldEmail: "manager@predimaint.local",
    email: "manager@gmail.com",
    firstName: "Ayoub",
    lastName: "Bahroun",
  },
  {
    oldEmail: "admin@predimaint.local",
    email: "admin@gmail.com",
    firstName: "Bakir",
    lastName: "Kammoun",
  },
];

async function updateDemoUsers() {
  await connectDb();

  try {
    const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 12);
    for (const demoUser of demoUsers) {
      const [legacyUser, currentUser] = await Promise.all([
        User.findOne({ email: demoUser.oldEmail }),
        User.findOne({ email: demoUser.email }),
      ]);
      if (legacyUser && currentUser && !legacyUser._id.equals(currentUser._id)) {
        throw new Error(`Deux comptes de démonstration existent pour ${demoUser.email}`);
      }

      const user = currentUser ?? legacyUser;
      if (!user) {
        logger.warn("Compte de démonstration introuvable", {
          email: demoUser.email,
        });
        continue;
      }

      const result = await User.updateOne(
        { _id: user._id },
        {
          $set: {
            email: demoUser.email,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
            passwordHash,
          },
        },
      );

      logger.info("Compte de démonstration mis à jour", {
        previousEmail: demoUser.oldEmail,
        email: demoUser.email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        modified: result.modifiedCount > 0,
      });
    }
  } finally {
    await disconnectDb();
  }
}

updateDemoUsers().catch((error) => {
  logger.error("Mise à jour des comptes de démonstration impossible", error);
  process.exitCode = 1;
});
