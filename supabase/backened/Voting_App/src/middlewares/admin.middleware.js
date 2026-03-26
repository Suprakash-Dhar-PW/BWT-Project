module.exports = (req, res, next) => {
  const isAdmin = req.user?.is_admin === true || req.user?.isAdmin === true || req.user?.role === "ADMIN";
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};