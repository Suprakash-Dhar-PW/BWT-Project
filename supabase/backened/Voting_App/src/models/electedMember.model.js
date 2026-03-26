const mongoose = require("mongoose");

const electedMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", index: true },
    position: {
      type: String,
      enum: ["PRESIDENT", "SECRETARY", "TREASURER"],
      index: true,
    },
    electionSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
    },
    declaredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
    },
  },
  { timestamps: true }
);

// One elected record per election session.
electedMemberSchema.index(
  { electionSessionId: 1 },
  { unique: true }
);

module.exports = mongoose.model("ElectedMember", electedMemberSchema);

