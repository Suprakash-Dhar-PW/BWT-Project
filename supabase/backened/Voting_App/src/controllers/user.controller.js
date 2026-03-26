const Member = require("../models/member.model");
const Election = require("../models/election.model");
const Nomination = require("../models/nomination.model");
const Vote = require("../models/vote.model");
const ElectedMember = require("../models/electedMember.model");

const positionOrder = ["PRESIDENT", "SECRETARY", "TREASURER"];

function getPositionIndex(position) {
  return positionOrder.indexOf(position);
}

async function getNomineesWithCounts(position, electionId) {
  const nominations = await Nomination.find({ position, approved: true }).populate({
    path: "memberId",
    match: { isActive: true },
    select: "name email phone isActive",
  });

  const filtered = nominations.filter((n) => n.memberId);

  const voteCounts = await Vote.aggregate([
    { $match: { electionId, role: position } },
    { $group: { _id: "$candidateId", voteCount: { $sum: 1 } } },
  ]);

  const voteCountMap = new Map(
    voteCounts.map((r) => [String(r._id), Number(r.voteCount)])
  );

  const nominees = filtered.map((n) => ({
    nomineeMemberId: n.memberId._id,
    nominee: n.memberId,
    voteCount: voteCountMap.get(String(n.memberId._id)) ?? 0,
    nominationId: n._id,
  }));

  return nominees;
}

exports.getMe = async (req, res) => {
  const user = await Member.findById(req.user.id).select("name email phone can_vote isAdmin isActive");
  if (!user || !user.isActive) return res.status(404).json({ message: "User not found" });
  res.json({ me: user });
};

exports.currentElection = async (req, res) => {
  const user = await Member.findById(req.user.id);
  if (!user || !user.isActive) return res.status(403).json({ message: "Not allowed" });

  const active = await Election.findOne({ status: "active" }).sort({ createdAt: -1 });
  const declaredElections = await Election.find({ status: "results_declared" }).sort({ createdAt: -1 });

  const resultsDeclared = await Promise.all(
    declaredElections.map(async (e) => {
      return {
        sessionId: e._id,
        position: e.position,
        winnerUserId: e.winnerUserId,
        winner: e.winnerUserId ? await Member.findById(e.winnerUserId).select("name email phone") : null,
        isTie: e.isTie,
        maxVotes: e.maxVotes,
        declaredByUserId: e.declaredByUserId,
        declaredAt: e.updatedAt || e.createdAt,
      };
    })
  );

  if (active) {
    const hasVoted = await Vote.findOne({
      electionId: active._id,
      voterId: user._id,
      role: active.position,
    });

    const elected = await ElectedMember.find({ userId: user._id }).select("position");
    const electedPositions = elected.map((x) => x.position);
    const currentIndex = getPositionIndex(active.position);
    const blocked = electedPositions.some((p) => getPositionIndex(p) <= currentIndex);

    const canVote =
      user.can_vote === true && !hasVoted && !blocked;

    const nominees = await getNomineesWithCounts(active.position, active._id);

    return res.json({
      activeSession: {
        sessionId: active._id,
        position: active.position,
        nominees,
        canVote,
        hasVoted: Boolean(hasVoted),
        message: canVote
          ? "Eligible to vote"
          : user.can_vote
            ? blocked
              ? "You cannot vote in remaining positions (elected earlier)."
              : hasVoted
                ? "Your vote has already been recorded for this session."
                : "You are not eligible to vote."
            : "You are not eligible to vote.",
      },
      tiePendingSession: null,
      resultsDeclared,
    });
  }

  const tiePending = await Election.findOne({ status: "ended", isTie: true }).sort({ createdAt: -1 });
  if (tiePending) {
    // Provide tie message + tied nominees with vote counts.
    const nominees = await getNomineesWithCounts(tiePending.position, tiePending._id);
    const tiedSet = new Set((tiePending.tiedNomineeIds || []).map((x) => String(x)));
    const tiedNominees = nominees.filter((n) => tiedSet.has(String(n.nomineeMemberId)));

    return res.json({
      activeSession: null,
      tiePendingSession: {
        sessionId: tiePending._id,
        position: tiePending.position,
        isTie: true,
        message: "Admin will announce the winner soon.",
        tiedNominees,
      },
      resultsDeclared,
    });
  }

  // No active session; only show past results.
  return res.json({
    activeSession: null,
    tiePendingSession: null,
    resultsDeclared,
    message: "No voting session in progress",
  });
};

