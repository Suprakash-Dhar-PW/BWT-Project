const Election = require("../models/election.model");
const Nomination = require("../models/nomination.model");
const Vote = require("../models/vote.model");
const Member = require("../models/member.model");
const ElectedMember = require("../models/electedMember.model");

const positionOrder = ["PRESIDENT", "SECRETARY", "TREASURER"];
function getPositionIndex(position) {
  return positionOrder.indexOf(position);
}

exports.vote = async (req, res) => {
  const { sessionId, nomineeId } = req.body;

  if (!sessionId || !nomineeId) {
    return res.status(400).json({ message: "sessionId and nomineeId are required" });
  }

  const election = await Election.findById(sessionId);
  if (!election) return res.status(404).json({ message: "Session not found" });
  if (election.status !== "active") {
    return res.status(400).json({ message: "Voting is not active for this session" });
  }

  const user = await Member.findById(req.user.id);
  if (!user || !user.isActive) return res.status(403).json({ message: "Not allowed" });
  if (user.can_vote !== true) return res.status(403).json({ message: "You are not eligible to vote" });

  const elected = await ElectedMember.find({ userId: user._id }).select("position");
  const currentIndex = getPositionIndex(election.position);
  const blocked = elected.some((x) => getPositionIndex(x.position) <= currentIndex);
  if (blocked) {
    return res.status(403).json({ message: "You cannot vote in remaining positions." });
  }

  const nomination = await Nomination.findOne({
    memberId: nomineeId,
    position: election.position,
    approved: true,
  }).populate({
    path: "memberId",
    match: { isActive: true },
    select: "_id",
  });

  if (!nomination || !nomination.memberId) {
    return res.status(400).json({ message: "Invalid nominee for this position" });
  }

  const hasVoted = await Vote.findOne({
    electionId: election._id,
    voterId: user._id,
    role: election.position,
  });

  if (hasVoted) {
    return res.status(400).json({ message: "Your vote has already been recorded for this session" });
  }

  try {
    await Vote.create({
      voterId: user._id,
      candidateId: nomineeId,
      electionId: election._id,
      role: election.position,
    });
  } catch (e) {
    // Unique index should cover duplicates
    return res.status(400).json({ message: "Your vote has already been recorded for this session" });
  }

  return res.status(201).json({ message: "Vote recorded successfully" });
};

