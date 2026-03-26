const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const admin = require("../middlewares/admin.middleware");

const adminElectionController = require("../controllers/adminElection.controller");

// Admin-only endpoints
router.post("/start", auth, admin, adminElectionController.startSession);
router.post("/end", auth, admin, adminElectionController.endSession);
router.get("/results/:sessionId", auth, admin, adminElectionController.getResults);
router.post("/declare-winner", auth, admin, adminElectionController.declareWinner);
router.get("/history", auth, admin, adminElectionController.history);

module.exports = router;

