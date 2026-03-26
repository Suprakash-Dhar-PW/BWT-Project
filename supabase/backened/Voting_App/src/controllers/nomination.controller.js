const Nomination = require("../models/nomination.model");
const Member = require("../models/member.model");
const Election = require("../models/election.model");

function normalizePosition(position) {
  const p = String(position || "").toUpperCase();
  if (p === "PRESIDENT" || p === "SECRETARY" || p === "TREASURER") return p;
  return null;
}

// Admin: add nominee for a position (global, not tied to an election session).
// POST /admin/nominees { userId, position }
exports.addNominee = async (req, res) => {
  const { userId, position } = req.body;
  const pos = normalizePosition(position);

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!pos) return res.status(400).json({ message: "position is invalid" });

  const member = await Member.findById(userId);
  if (!member || !member.isActive) {
    return res.status(400).json({ message: "Invalid member" });
  }

  const active = await Election.findOne({ status: "active" });
  if (active) {
    return res.status(400).json({ message: "Nominees can only be managed before an active session starts" });
  }

  try {
    const nomination = await Nomination.create({
      memberId: userId,
      position: pos,
      approved: true,
    });

    res.status(201).json({ nomination });
  } catch (e) {
    return res.status(400).json({ message: "Nominee already exists for this position" });
  }
};

// Admin: remove nominee
// DELETE /admin/nominees/:id
exports.removeNominee = async (req, res) => {
  const { id } = req.params;

  const active = await Election.findOne({ status: "active" });
  if (active) {
    return res.status(400).json({ message: "Nominees can only be removed before an active session starts" });
  }

  const result = await Nomination.findByIdAndDelete(id);
  if (!result) return res.status(404).json({ message: "Nomination not found" });
  res.json({ message: "Nomination removed" });
};

