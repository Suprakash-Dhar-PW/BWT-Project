const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema({
  name: String,

  position: {
    type: String,
    enum: ["PRESIDENT", "SECRETARY", "TREASURER"],
    default: "PRESIDENT",
  },

  status: {
    type: String,
    enum: ["pending", "active", "ended", "results_declared"],
    default: "pending",
  },

  // Results fields
  winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
  declaredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
  isTie: { type: Boolean, default: false },
  tiedNomineeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],

  maxVotes: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Election", electionSchema);