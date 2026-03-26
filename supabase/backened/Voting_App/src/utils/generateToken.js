const jwt = require("jsonwebtoken");

module.exports = (payload) => {
  const secret = process.env.JWT_SECRET || "CHANGE_ME_STRONG_SECRET";
  return jwt.sign(payload, secret, { expiresIn: "24h" });
};