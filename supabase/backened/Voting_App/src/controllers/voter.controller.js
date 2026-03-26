const Election = require("../models/election.model");
const Nomination = require("../models/nomination.model");
const Vote = require("../models/vote.model");
const Member = require("../models/member.model");

const positionOrder = ["PRESIDENT", "SECRETARY", "TREASURER"];
const getPositionIndex = (position) => positionOrder.indexOf(position);

async function getNomineesWithVoteCounts(election) {
  const nominees = await Nomination.find({
    electionId: election._id,
    role: election.currentPhase,
    approved: true,
  }).populate("memberId", "name phone email isEligibleVoter isEligibleToNominate eligibleRoles electedRoles");

  const voteCounts = await Vote.aggregate([
    { $match: { electionId: election._id, role: election.currentPhase } },
    { $group: { _id: "$candidateId", voteCount: { $sum: 1 } } },
  ]);

  const voteCountMap = new Map(
    voteCounts.map((r) => [String(r._id), Number(r.voteCount)])
  );

  const nomineesWithCounts = nominees.map((n) => {
    const candidateId = String(n.memberId._id);
    return {
      nomineeMemberId: n.memberId._id,
      nominee: n.memberId,
      voteCount: voteCountMap.get(candidateId) ?? 0,
    };
  });

  const maxVotes =
    nomineesWithCounts.length > 0
      ? Math.max(...nomineesWithCounts.map((x) => x.voteCount))
      : 0;

  const tiedNominees = nomineesWithCounts
    .filter((x) => x.voteCount === maxVotes)
    .map((x) => x.nomineeMemberId);

  const tie = tiedNominees.length > 1;

  return { nominees: nomineesWithCounts, maxVotes, tiedNominees, tie };
}

exports.dashboard = async (req, res) => {
  const voter = await Member.findById(req.user.id);
  if (!voter || !voter.isActive) return res.status(403).json({ message: "Not allowed" });

  const activeElection = await Election.findOne({ status: "ACTIVE" });
  const endedElection = await Election.findOne({ status: "ENDED" });

  const declaredElections = await Election.find({ status: "RESULTS_DECLARED" }).sort({
    createdAt: 1,
  });

  const resultsDeclared = await Promise.all(
    declaredElections.map(async (e) => {
      const { nominees, maxVotes, tiedNominees } = await getNomineesWithVoteCounts(e);
      return {
        electionId: e._id,
        position: e.currentPhase,
        winnerMemberId: e.winnerMemberId,
        tie: e.tie,
        maxVotes,
        tiedNominees,
        nominees,
      };
    })
  );

  if (activeElection) {
    const position = activeElection.currentPhase;
    const positionIndex = getPositionIndex(position);
    const { nominees } = await getNomineesWithVoteCounts(activeElection);

    const useAllowedVoters = Array.isArray(activeElection.allowedVoterIds);
    const allowedVoterSet = useAllowedVoters
      ? new Set(activeElection.allowedVoterIds.map((id) => String(id)))
      : null;

    const electedRoles = Array.isArray(voter.electedRoles) ? voter.electedRoles : [];
    const hasElectedEarlierOrCurrent = electedRoles.some(
      (r) => getPositionIndex(r) !== -1 && getPositionIndex(r) <= positionIndex
    );

    const alreadyVoted = await Vote.findOne({
      voterId: voter._id,
      electionId: activeElection._id,
      role: position,
    });

    let canVote = true;
    let reason = "Eligible to vote";

    if (useAllowedVoters && allowedVoterSet && !allowedVoterSet.has(String(voter._id))) {
      canVote = false;
      reason = "You are not admitted to vote in this session";
    } else if (!useAllowedVoters && !voter.isEligibleVoter) {
      canVote = false;
      reason = "You are not eligible to vote";
    } else if (hasElectedEarlierOrCurrent) {
      canVote = false;
      const blockedFor = electedRoles
        .filter((r) => getPositionIndex(r) !== -1 && getPositionIndex(r) <= positionIndex)
        .join(", ");
      reason = blockedFor
        ? `You have been elected for (${blockedFor}) and cannot vote`
        : "You have been elected and cannot vote";
    } else if (alreadyVoted) {
      canVote = false;
      reason = "You have already voted in this session";
    }

    return res.json({
      activeSession: {
        electionId: activeElection._id,
        position,
      },
      canVote,
      reason,
      nominees,
      resultsDeclared,
    });
  }

  if (endedElection) {
    const position = endedElection.currentPhase;
    const { nominees, maxVotes, tiedNominees, tie } = await getNomineesWithVoteCounts(endedElection);

    return res.json({
      activeSession: null,
      tiePendingSession: {
        electionId: endedElection._id,
        position,
        tie,
        maxVotes,
        tiedNominees,
        message: tie
          ? "Tie detected. Admin will announce the winner soon."
          : "Voting ended. Admin will declare the winner soon.",
      },
      canVote: false,
      nominees,
      resultsDeclared,
    });
  }

  return res.json({
    activeSession: null,
    tiePendingSession: null,
    canVote: false,
    reason: "No voting session in progress",
    resultsDeclared,
  });
};

exports.getResults = async (req, res) => {
  const declaredElections = await Election.find({ status: "RESULTS_DECLARED" }).sort({
    createdAt: 1,
  });
  const resultsDeclared = await Promise.all(
    declaredElections.map(async (e) => {
      const { nominees, maxVotes, tiedNominees, tie } = await getNomineesWithVoteCounts(e);
      return {
        electionId: e._id,
        position: e.currentPhase,
        winnerMemberId: e.winnerMemberId,
        tie: tie,
        maxVotes,
        tiedNominees,
        nominees,
      };
    })
  );

  res.json({ resultsDeclared });
};

// Voter: allow updating display name (optional).
exports.updateProfile = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "name is required" });

  const voter = await Member.findById(req.user.id);
  if (!voter) return res.status(404).json({ message: "Member not found" });

  voter.name = name;
  await voter.save();

  res.json({ message: "Profile updated", voter });
};

