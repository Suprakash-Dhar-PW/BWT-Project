const Member = require("../models/member.model");
const Otp = require("../models/otp.model");
const generateToken = require("../utils/generateToken");
const bcrypt = require("bcrypt");

// SEND OTP
exports.sendOtp = async (req, res) => {
  const { phone, email, identifier } = req.body;
  const id = identifier || phone || email;

  if (!id) {
    return res.status(400).json({ message: "email or phone is required" });
  }

  const member = await Member.findOne({
    $or: [{ phone: id }, { email: id }],
  });

  if (!member || !member.isActive) {
    return res.status(403).json({ message: "Not allowed" });
  }

  // delete old OTPs
  await Otp.deleteMany({ identifier: id });

  // Generate a 10-digit OTP (no leading zeros).
  const otp = Math.floor(1000000000 + Math.random() * 9000000000);
  const otpStr = String(otp);
  const otpHash = await bcrypt.hash(otpStr, 10);

  await Otp.create({
    identifier: id,
    otpHash,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  // Mock OTP delivery: we log it for development.
  console.log("OTP for", id, ":", otpStr);

  const canReturnOtpInResponse =
    String(process.env.NODE_ENV || "").toLowerCase() !== "production";

  if (canReturnOtpInResponse) {
    // Allow website testing without SMS/email provider integration.
    return res.json({ message: "OTP sent successfully", otp: otpStr });
  }

  return res.json({ message: "OTP sent successfully" });
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  const { phone, email, identifier, otp } = req.body;
  const id = identifier || phone || email;

  if (!id || !otp) {
    return res.status(400).json({ message: "identifier and otp are required" });
  }

  const otpStr = String(otp).replace(/\D/g, "");
  if (otpStr.length !== 10) {
    return res.status(400).json({ message: "OTP must be exactly 10 digits" });
  }

  const record = await Otp.findOne({ identifier: id });

  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ message: "Invalid OTP" });
  }
  if (!record.otpHash) {
    return res.status(400).json({ message: "Invalid OTP (OTP format mismatch)" });
  }

  const ok = await bcrypt.compare(otpStr, record.otpHash);
  if (!ok) return res.status(400).json({ message: "Invalid OTP" });

  const member = await Member.findOne({
    $or: [{ phone: id }, { email: id }],
  });

  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  // delete OTP after use
  await Otp.deleteOne({ _id: record._id });

  const token = generateToken({
    id: member._id,
    role: member.role,
    is_admin: member.isAdmin === true,
    isAdmin: member.isAdmin === true,
  });

  res.json({ token });
};