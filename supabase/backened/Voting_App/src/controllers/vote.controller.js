const Election = require("../models/election.model");
const Nomination = require("../models/nomination.model");
const Vote = require("../models/vote.model");
const Member = require("../models/member.model");

const positionOrder = ["PRESIDENT", "SECRETARY", "TREASURER"];
const getPositionIndex = (position) => positionOrder.indexOf(position);

exports.castVote = async (req, res) => {
  const { electionId, nomineeMemberId } = req.body;

  if (!electionId || !nomineeMemberId) {
    return res.status(400).json({ message: "electionId and nomineeMemberId are required" });
  }

  const election = await Election.findById(electionId);
  if (!election) return res.status(404).json({ message: "Election not found" });
  if (election.status !== "ACTIVE") {
    return res.status(400).json({ message: "Voting is not active for this election" });
  }

  const position = election.currentPhase;
  const positionIndex = getPositionIndex(position);

  const voter = await Member.findById(req.user.id);
  if (!voter || !voter.isActive) return res.status(403).json({ message: "Not allowed" });

  // Admissions override: if election.allowedVoterIds is set, it overrides global `isEligibleVoter`.
  const useAllowedVoters = Array.isArray(election.allowedVoterIds);
  if (useAllowedVoters) {
    const allowedSet = new Set(election.allowedVoterIds.map((id) => String(id)));
    if (!allowedSet.has(String(voter._id))) {
      return res.status(403).json({ message: "You are not admitted to vote in this session" });
    }
  } else if (!voter.isEligibleVoter) {
    return res.status(403).json({ message: "You are not eligible to vote" });
  }

  // If elected earlier than (or at) current position, voter can't vote.
  const electedRoles = Array.isArray(voter.electedRoles) ? voter.electedRoles : [];
  const hasElectedEarlierOrCurrent = electedRoles.some(
    (r) => getPositionIndex(r) !== -1 && getPositionIndex(r) <= positionIndex
  );
  if (hasElectedEarlierOrCurrent) {
    return res.status(403).json({
      message: "You have been elected for a previous (or current) position and cannot vote further",
      electedRoles,
    });
  }

  const nomination = await Nomination.findOne({
    electionId,
    memberId: nomineeMemberId,
    role: position,
    approved: true,
  });
  if (!nomination) {
    return res.status(400).json({ message: "Invalid nominee for this session" });
  }

  const alreadyVoted = await Vote.findOne({
    voterId: voter._id,
    electionId,
    role: position,
  });

  if (alreadyVoted) {
    return res.status(400).json({ message: "You have already voted in this session" });
  }

  try {
    const vote = await Vote.create({
      voterId: voter._id,
      candidateId: nomineeMemberId,
      electionId,
      role: position,
    });

    // Do not return vote document (it contains internal voterId).
    return res.status(201).json({ message: "Vote submitted successfully" });
  } catch (err) {
    // Covers the unique index constraint.
    return res.status(400).json({ message: "Vote already submitted for this session" });
  }
};

