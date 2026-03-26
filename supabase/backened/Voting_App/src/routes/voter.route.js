const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");

const userController = require("../controllers/user.controller");
const userVoteController = require("../controllers/userVote.controller");

router.get("/me", auth, userController.getMe);
router.get("/current-election", auth, userController.currentElection);
router.post("/vote", auth, userVoteController.vote);

module.exports = router;

