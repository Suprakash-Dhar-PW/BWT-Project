const Member = require("../models/member.model");
const Nomination = require("../models/nomination.model");
const MemberAudit = require("../models/memberAudit.model");

const positionKeys = ["PRESIDENT", "SECRETARY", "TREASURER"];

exports.listMembers = async (req, res) => {
  const members = await Member.find({ isActive: true }).sort({ createdAt: -1 });
  const memberIds = members.map((m) => m._id);

  const nominations = await Nomination.find({
    memberId: { $in: memberIds },
    approved: true,
  });

  const nomineeMap = new Map(); // memberId -> Set(position)
  for (const n of nominations) {
    const mid = String(n.memberId);
    if (!nomineeMap.has(mid)) nomineeMap.set(mid, new Set());
    nomineeMap.get(mid).add(n.position);
  }

  const rows = members.map((m) => {
    const set = nomineeMap.get(String(m._id)) || new Set();
    return {
      id: m._id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      is_admin: m.isAdmin === true,
      can_vote: m.can_vote === true,
      nomineePresident: set.has("PRESIDENT"),
      nomineeSecretary: set.has("SECRETARY"),
      nomineeTreasurer: set.has("TREASURER"),
      createdAt: m.createdAt,
    };
  });

  res.json({ members: rows });
};

exports.addMember = async (req, res) => {
  const { name, email, phone, can_vote } = req.body;

  if (!name) return res.status(400).json({ message: "name is required" });
  if (!email && !phone) {
    return res.status(400).json({ message: "email or phone is required" });
  }

  const or = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  const existing = await Member.findOne({ $or: or });
  if (existing) return res.status(400).json({ message: "Member already exists" });

  const member = await Member.create({
    name,
    email: email || undefined,
    phone: phone || undefined,
    can_vote: Boolean(can_vote),
    // Prevent creating extra admins from UI.
    isAdmin: false,
  });

  res.status(201).json({ member });
};

exports.updateMember = async (req, res) => {
  const { id } = req.params;
  const { name, can_vote } = req.body;

  const member = await Member.findById(id);
  if (!member || !member.isActive) {
    return res.status(404).json({ message: "Member not found" });
  }

  if (name !== undefined) member.name = name;
  if (can_vote !== undefined) member.can_vote = Boolean(can_vote);

  await member.save();
  res.json({ member });
};

exports.softDeleteMember = async (req, res) => {
  const { id } = req.params;
  const member = await Member.findById(id);
  if (!member || !member.isActive) {
    return res.status(404).json({ message: "Member not found" });
  }

  const prevSnapshot = {
    id: member._id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    isAdmin: member.isAdmin,
    can_vote: member.can_vote,
  };

  member.isActive = false;
  member.can_vote = false;
  await member.save();

  await MemberAudit.create({
    memberId: member._id,
    action: "delete",
    prevSnapshot,
    performedByUserId: req.user.id,
  });

  res.json({ message: "Member deleted (soft delete)" });
};

