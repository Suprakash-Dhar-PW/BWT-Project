const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const admin = require("../middlewares/admin.middleware");

const nominationController = require("../controllers/nomination.controller");

// Admin: manage global nominee list per position
router.post("/", auth, admin, nominationController.addNominee);
router.delete("/:id", auth, admin, nominationController.removeNominee);

module.exports = router;

