exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const record = await Otp.findOne({ identifier: email, otp });

  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const member = await Member.findOne({ email });

  const token = generateToken(member._id);

  res.json({ token });
};