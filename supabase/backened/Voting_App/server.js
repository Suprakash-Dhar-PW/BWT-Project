const express = require("express");
const connectDB = require("./src/config/db");
const app = require("./src/app");
const Member = require("./src/models/member.model");
const Nomination = require("./src/models/nomination.model");

async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "eshabajaj1626@gmail.com";

  let admin = await Member.findOne({ email: adminEmail });
  if (!admin) {
    admin = await Member.create({
      name: "Admin",
      email: adminEmail,
      phone: undefined,
      isAdmin: true,
      can_vote: false,
      isActive: true,
    });
  } else {
    admin.isAdmin = true;
    admin.isActive = true;
    admin.can_vote = false;
    await admin.save();
  }

  // If another admin email exists from earlier iterations, demote it.
  const otherAdminEmail = "esha1626@gmail.com";
  if (otherAdminEmail && otherAdminEmail !== adminEmail) {
    await Member.updateMany(
      { email: otherAdminEmail, isAdmin: true },
      { $set: { isAdmin: false } }
    );
  }
}

async function ensureNominationIndexes() {
  try {
    // Drop stale legacy unique index that blocks inserts after schema changes.
    // Old index name from getIndexes():
    //   electionId_1_memberId_1_role_1
    await Nomination.collection.dropIndex("electionId_1_memberId_1_role_1");
    console.log("Dropped legacy nomination index");
  } catch (e) {
    // Ignore if index does not exist or cannot be dropped.
  }
}

// ✅ Connect DB + ensure admin, then start server
connectDB()
  .then(async () => {
    await ensureAdmin();
    await ensureNominationIndexes();
    app.listen(5000, () => {
      console.log("Server running on port 5000");
    });
  })
  .catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });