const express = require("express");
const app = express();
const memberRoutes = require("./routes/member.route.js");

app.use(express.json());

const authRoutes = require("./routes/auth.route.js");
const electionRoutes = require("./routes/election.route.js");
const nominationRoutes = require("./routes/nomination.route.js");
const voterRoutes = require("./routes/voter.route.js");

// Spec routes
app.use("/auth", authRoutes);
app.use("/admin/members", memberRoutes);
app.use("/admin/election", electionRoutes);
app.use("/admin/nominees", nominationRoutes);
app.use("/user", voterRoutes);

module.exports = app;
