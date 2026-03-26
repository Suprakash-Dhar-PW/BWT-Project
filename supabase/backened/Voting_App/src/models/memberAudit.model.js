const mongoose = require("mongoose");

const memberAuditSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", index: true },
    action: { type: String, enum: ["delete"], index: true },
    prevSnapshot: { type: Object },
    performedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MemberAudit", memberAuditSchema);

