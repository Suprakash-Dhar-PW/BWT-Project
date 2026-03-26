const Member = require("../models/member.model");
const Nomination = require("../models/nomination.model");
const Vote = require("../models/vote.model");
const Election = require("../models/election.model");

// ➕ Add Member
exports.addMember = async (req, res) => {
  const {
    name,
    phone,
    email,
    isEligibleVoter,
    isEligibleToNominate,
    eligibleRoles,
    isAdmin,
  } = req.body;

  if (!phone && !email) {
    return res.status(400).json({ message: "phone or email is required" });
  }

  const or = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });

  const exists = await Member.findOne({ $or: or });
  if (exists) return res.status(400).json({ message: "Member already exists" });

  const member = await Member.create({
    name,
    phone,
    email,
    isEligibleVoter: Boolean(isEligibleVoter),
    isEligibleToNominate: Boolean(isEligibleToNominate),
    eligibleRoles: Array.isArray(eligibleRoles) ? eligibleRoles : undefined,
    isAdmin: Boolean(isAdmin),
  });

  res.status(201).json(member);
};

// 📋 Get All Members
exports.getMembers = async (req, res) => {
  const members = await Member.find();
  res.json(members);
};

// 🔄 Activate / Deactivate Member
exports.toggleMember = async (req, res) => {
  const { id } = req.params;

  const member = await Member.findById(id);
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  member.isActive = !member.isActive;
  await member.save();

  res.json(member);
};

// 🎯 Set Eligibility
exports.setEligibility = async (req, res) => {
  const { id } = req.params;
  const { isEligibleVoter, isEligibleToNominate, eligibleRoles } = req.body;

  const member = await Member.findById(id);
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  member.isEligibleVoter = isEligibleVoter;
  member.isEligibleToNominate = isEligibleToNominate;
  member.eligibleRoles = eligibleRoles;

  await member.save();

  res.json(member);
};

// ✏️ Edit member details (name, phone/email, eligibility)
exports.updateMember = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    phone,
    email,
    isEligibleVoter,
    isEligibleToNominate,
    eligibleRoles,
    isActive,
    // Optional: allow changing admin flag (still protected by admin middleware).
    isAdmin,
  } = req.body;

  const member = await Member.findById(id);
  if (!member) return res.status(404).json({ message: "Member not found" });

  if (phone !== undefined) member.phone = phone;
  if (email !== undefined) member.email = email;
  if (name !== undefined) member.name = name;
  if (isActive !== undefined) member.isActive = isActive;

  if (isEligibleVoter !== undefined) member.isEligibleVoter = Boolean(isEligibleVoter);
  if (isEligibleToNominate !== undefined)
    member.isEligibleToNominate = Boolean(isEligibleToNominate);
  if (eligibleRoles !== undefined) member.eligibleRoles = eligibleRoles;
  if (isAdmin !== undefined) member.isAdmin = Boolean(isAdmin);

  await member.save();
  res.json(member);
};

// 🗑️ Delete member only if it isn't tied to nominations/votes/results
exports.deleteMember = async (req, res) => {
  const { id } = req.params;

  const member = await Member.findById(id);
  if (!member) return res.status(404).json({ message: "Member not found" });

  const hasNomination = await Nomination.exists({ memberId: id });
  const hasVoteAsVoter = await Vote.exists({ voterId: id });
  const hasVoteAsCandidate = await Vote.exists({ candidateId: id });
  const hasElected = await Election.exists({ winnerMemberId: id });

  if (hasNomination || hasVoteAsVoter || hasVoteAsCandidate || hasElected) {
    return res.status(400).json({
      message: "Cannot delete member: votes/elections are linked",
    });
  }

  await Member.deleteOne({ _id: id });
  res.json({ message: "Member deleted" });
};