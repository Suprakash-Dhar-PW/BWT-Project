const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  let token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (typeof token === "string" && token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  try {
    const secret = process.env.JWT_SECRET || "CHANGE_ME_STRONG_SECRET";
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};