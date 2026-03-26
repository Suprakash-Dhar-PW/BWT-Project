const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  voterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member"
  },

  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member"
  },

  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election"
  },

  role: {
    type: String,
    enum: ["PRESIDENT", "SECRETARY", "TREASURER"]
  }

}, { timestamps: true });

voteSchema.index({ voterId: 1, electionId: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("Vote", voteSchema);