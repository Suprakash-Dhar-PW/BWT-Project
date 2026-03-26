const mongoose = require("mongoose");

const nominationSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
  },

  position: {
    type: String,
    enum: ["PRESIDENT", "SECRETARY", "TREASURER"],
  },

  // Kept for compatibility; admin nominations are active immediately.
  approved: { type: Boolean, default: true },

}, { timestamps: true });

// Prevent duplicate nominations for the same position/member.
nominationSchema.index({ memberId: 1, position: 1 }, { unique: true });

module.exports = mongoose.model("Nomination", nominationSchema);