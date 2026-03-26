const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  identifier: String,
  otpHash: String,
  expiresAt: Date
});

module.exports = mongoose.model("Otp", otpSchema);