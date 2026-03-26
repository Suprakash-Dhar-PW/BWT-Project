const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const admin = require("../middlewares/admin.middleware");

const adminMembersController = require("../controllers/adminMembers.controller");

router.get("/", auth, admin, adminMembersController.listMembers);
router.post("/", auth, admin, adminMembersController.addMember);
router.put("/:id", auth, admin, adminMembersController.updateMember);
router.delete("/:id", auth, admin, adminMembersController.softDeleteMember);

module.exports = router;