exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  const member = await Member.findOne({ email });
  if (!member || !member.isActive) {
    return res.status(403).json({ message: "Not allowed" });
  }

  // Generate a 10-digit OTP (no leading zeros).
  const otp = Math.floor(1000000000 + Math.random() * 9000000000);

  await Otp.create({
    identifier: email,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  // send OTP via email
  res.json({ message: "OTP sent" });
};