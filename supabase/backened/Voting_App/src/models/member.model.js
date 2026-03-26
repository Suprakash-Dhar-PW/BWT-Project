const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  // Some earlier iterations created a unique index on `identifier`.
  // We keep it to ensure inserts don't fail when the field is missing (null).
  identifier: { type: String, unique: true },

  isActive: { type: Boolean, default: true },

  // Used for admin login recognition (based on `is_admin` in requirements).
  isAdmin: { type: Boolean, default: false },

  role: {
    type: String,
    enum: ["MEMBER", "ADMIN"],
    default: "MEMBER",
  },

  // Whether this member is allowed to vote.
  can_vote: { type: Boolean, default: false },

  // Backward compatibility fields from earlier iterations.
  isEligibleVoter: { type: Boolean, default: false },
  isEligibleToNominate: { type: Boolean, default: false },

  eligibleRoles: [{
    type: String,
    enum: ["PRESIDENT", "SECRETARY", "TREASURER"]
  }],

  // Once elected for a position, member is blocked from voting in later positions.
  electedRoles: [{
    type: String,
    enum: ["PRESIDENT", "SECRETARY", "TREASURER"]
  }]
}, { timestamps: true });

// Keep `role` in sync with `isAdmin`.
memberSchema.pre("save", function (next) {
  if (this.isAdmin) {
    this.role = "ADMIN";
  } else if (this.role === "ADMIN") {
    this.role = "MEMBER";
  }

  // Older field `isEligibleVoter` is kept only for backward compatibility.
  // `can_vote` is the source of truth going forward.

  // Ensure `identifier` is always non-null for unique index compatibility.
  if (!this.identifier) {
    if (this.email) this.identifier = this.email;
    else if (this.phone) this.identifier = this.phone;
    else this.identifier = String(this._id); // last resort to avoid null duplicates
  }
  // Mongoose may call hooks with promise-based semantics depending on version/config.
  // Only call next() when it's provided.
  if (typeof next === "function") next();
});

module.exports = mongoose.model("Member", memberSchema);