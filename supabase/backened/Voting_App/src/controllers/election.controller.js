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
  }).populate("memberId", "name phone email role isAdmin isActive");

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
      nominationId: n._id,
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

// Admin: Start a new voting session for a position.
exports.startSession = async (req, res) => {
  const { position } = req.body;
  const {
    allowedVoterMemberIds,
    allowedNomineeMemberIds,
    allowedVoterEmails,
    allowedNomineeEmails,
    excludedVoterEmails,
    excludedNomineeEmails,
  } = req.body;

  if (!position || !positionOrder.includes(position)) {
    return res.status(400).json({ message: "Invalid position" });
  }

  // Prevent starting while any session is active or waiting for winner declaration.
  const activeSession = await Election.findOne({ status: "ACTIVE" });
  if (activeSession) {
    return res.status(400).json({ message: "Another voting session is active" });
  }

  const pendingDeclaration = await Election.findOne({ status: "ENDED" });
  if (pendingDeclaration) {
    return res.status(400).json({ message: "Finish declaration for previous position first" });
  }

  const requestedIndex = getPositionIndex(position);
  const alreadyDeclared = await Election.findOne({
    currentPhase: position,
    status: "RESULTS_DECLARED",
  });
  if (alreadyDeclared) {
    return res.status(400).json({ message: `${position} results already declared` });
  }

  // Enforce sequential order: PRESIDENT -> SECRETARY -> TREASURER
  for (let i = 0; i < requestedIndex; i++) {
    const earlierPos = positionOrder[i];
    const earlierDeclared = await Election.findOne({
      currentPhase: earlierPos,
      status: "RESULTS_DECLARED",
    });
    if (!earlierDeclared) {
      return res.status(400).json({
        message: `Start ${position} only after ${earlierPos} results are declared`,
      });
    }
  }

  // Admissions override (per-session)
  // Overrides are separate for voters vs nominees.
  const voterAdmissionOverrideRequested =
    Array.isArray(allowedVoterMemberIds) ||
    Array.isArray(allowedVoterEmails) ||
    Array.isArray(excludedVoterEmails);

  const nomineeAdmissionOverrideRequested =
    Array.isArray(allowedNomineeMemberIds) ||
    Array.isArray(allowedNomineeEmails) ||
    Array.isArray(excludedNomineeEmails);

  let resolvedAllowedVoterIds;
  let resolvedAllowedNomineeIds;

  const resolveAllowedIdsFromExplicit = async (explicitIds, label) => {
    const ids = Array.isArray(explicitIds) ? explicitIds : [];
    if (!ids.length) return [];
    const members = await Member.find({
      _id: { $in: ids },
      isActive: true,
      isAdmin: false,
    }).select("_id");
    const found = new Set(members.map((m) => String(m._id)));
    const missing = ids.filter((id) => !found.has(String(id)));
    if (missing.length) {
      return { ok: false, missingMemberIds: missing };
    }
    return { ok: true, ids: members.map((m) => m._id) };
  };

  if (voterAdmissionOverrideRequested) {
    // Start from explicit allowed lists if provided; otherwise compute from exclusions.
    if (Array.isArray(allowedVoterMemberIds)) {
      const resolved = await resolveAllowedIdsFromExplicit(
        allowedVoterMemberIds,
        "voter"
      );
      if (resolved.ok === false) {
        return res.status(400).json({
          message: "Some voter memberIds are invalid/ineligible",
          missingMemberIds: resolved.missingMemberIds,
        });
      }
      resolvedAllowedVoterIds = resolved.ids;
    } else if (Array.isArray(allowedVoterEmails)) {
      const members = await Member.find({
        email: { $in: allowedVoterEmails },
        isActive: true,
        isAdmin: false,
      }).select("_id");
      resolvedAllowedVoterIds = members.map((m) => m._id);
    } else if (Array.isArray(excludedVoterEmails)) {
      const members = await Member.find({
        isActive: true,
        isAdmin: false,
        email: { $nin: excludedVoterEmails },
      }).select("_id");
      resolvedAllowedVoterIds = members.map((m) => m._id);
    } else {
      resolvedAllowedVoterIds = [];
    }
  } else {
    return res.status(400).json({
      message:
        "At session start, admin must provide who can vote: send allowedVoterMemberIds, allowedVoterEmails, or excludedVoterEmails",
    });
  }

  if (nomineeAdmissionOverrideRequested) {
    if (Array.isArray(allowedNomineeMemberIds)) {
      const resolved = await resolveAllowedIdsFromExplicit(
        allowedNomineeMemberIds,
        "nominee"
      );
      if (resolved.ok === false) {
        return res.status(400).json({
          message: "Some nominee memberIds are invalid/ineligible",
          missingMemberIds: resolved.missingMemberIds,
        });
      }
      resolvedAllowedNomineeIds = resolved.ids;
    } else if (Array.isArray(allowedNomineeEmails)) {
      const members = await Member.find({
        email: { $in: allowedNomineeEmails },
        isActive: true,
        isAdmin: false,
      }).select("_id");
      resolvedAllowedNomineeIds = members.map((m) => m._id);
    } else if (Array.isArray(excludedNomineeEmails)) {
      const members = await Member.find({
        isActive: true,
        isAdmin: false,
        email: { $nin: excludedNomineeEmails },
      }).select("_id");
      resolvedAllowedNomineeIds = members.map((m) => m._id);
    } else {
      resolvedAllowedNomineeIds = [];
    }
  } else {
    return res.status(400).json({
      message:
        "At session start, admin must provide who can be nominated: send allowedNomineeMemberIds, allowedNomineeEmails, or excludedNomineeEmails",
    });
  }

  // If explicit allowed lists were empty, it's valid: it means "no one admitted".

  const election = await Election.create({
    name: `Voting Session - ${position}`,
    currentPhase: position,
    status: "ACTIVE",
    isActive: true,
    startDate: new Date(),
    endDate: null,
    maxVotes: 0,
    tie: false,
    tiedMemberIds: [],
    winnerMemberId: null,
    allowedVoterIds: resolvedAllowedVoterIds,
    allowedNomineeIds: resolvedAllowedNomineeIds,
  });

  res.status(201).json(election);
};

// Admin: Monitor the active session (nominees + current vote counts).
exports.getActiveSession = async (req, res) => {
  const election = await Election.findOne({ status: "ACTIVE" });
  if (!election) return res.json({ activeSession: null });

  const { nominees, maxVotes, tiedNominees, tie } =
    await getNomineesWithVoteCounts(election);

  res.json({
    activeSession: {
      electionId: election._id,
      position: election.currentPhase,
      status: election.status,
      nominees,
      voteSummary: { maxVotes, tie, tiedNominees },
    },
  });
};

// Admin: End voting and compute tie information.
exports.endSession = async (req, res) => {
  const { electionId } = req.params;

  const election = await Election.findById(electionId);
  if (!election) return res.status(404).json({ message: "Election not found" });
  if (election.status !== "ACTIVE") {
    return res.status(400).json({ message: "Session is not active" });
  }

  const { maxVotes, tiedNominees, tie, nominees } =
    await getNomineesWithVoteCounts(election);

  election.status = "ENDED";
  election.isActive = false;
  election.endDate = new Date();
  election.maxVotes = maxVotes;
  election.tie = tie;
  election.tiedMemberIds = tiedNominees;

  await election.save();

  res.json({
    electionId: election._id,
    position: election.currentPhase,
    status: election.status,
    tie,
    maxVotes,
    tiedNominees,
    nominees,
    message: tie
      ? "Tie detected. Admin must declare the winner soon."
      : "No tie. Ready for winner declaration.",
  });
};

// Admin: Declare winner (manual choice allowed for ties).
exports.declareWinner = async (req, res) => {
  const { electionId } = req.params;
  const { winnerNomineeMemberId, winnerName } = req.body;

  if (!winnerNomineeMemberId && !winnerName) {
    return res.status(400).json({ message: "Provide winnerNomineeMemberId or winnerName" });
  }

  const election = await Election.findById(electionId);
  if (!election) return res.status(404).json({ message: "Election not found" });
  if (election.status !== "ENDED") {
    return res.status(400).json({ message: "Session must be ended before declaration" });
  }

  const { maxVotes, tiedNominees, nominees } = await getNomineesWithVoteCounts(election);
  const allowed = tiedNominees.map((id) => String(id));
  let winnerId = winnerNomineeMemberId ? String(winnerNomineeMemberId) : null;

  if (!winnerId && winnerName) {
    const matched = nominees.filter((n) => n.nominee?.name === winnerName);
    if (!matched.length) {
      return res.status(400).json({ message: "winnerName did not match any tied nominee" });
    }
    if (matched.length > 1) {
      return res.status(400).json({ message: "winnerName matches multiple nominees; use winnerNomineeMemberId" });
    }
    winnerId = String(matched[0].nomineeMemberId);
  }

  if (!allowed.includes(winnerId)) {
    return res.status(400).json({
      message: "Winner must be among the highest vote candidates (tie candidates).",
      maxVotes,
      allowedWinnerMemberIds: tiedNominees,
    });
  }

  // Persist winner + status.
  election.status = "RESULTS_DECLARED";
  election.isActive = false;
  election.winnerMemberId = winnerId;
  await election.save();

  // Mark elected position on the member to block future voting.
  const Member = require("../models/member.model");
  await Member.updateOne(
    { _id: winnerId },
    { $addToSet: { electedRoles: election.currentPhase } }
  );

  res.json({
    electionId: election._id,
    position: election.currentPhase,
    status: election.status,
    winnerNomineeMemberId: winnerId,
    tie: election.tie,
    maxVotes,
    tiedNominees,
  });
};

// Admin: Overall results.
exports.getOverallResults = async (req, res) => {
  const declared = await Election.find({ status: "RESULTS_DECLARED" }).sort({ createdAt: 1 });
  const endedPending = await Election.find({ status: "ENDED" }).sort({ createdAt: 1 });

  res.json({
    declaredPositions: declared.map((e) => ({
      electionId: e._id,
      position: e.currentPhase,
      winnerMemberId: e.winnerMemberId,
      tie: e.tie,
      tiedMemberIds: e.tiedMemberIds,
      maxVotes: e.maxVotes,
      declaredAt: e.endDate || e.createdAt,
    })),
    tiePendingPositions: endedPending.map((e) => ({
      electionId: e._id,
      position: e.currentPhase,
      tie: e.tie,
      tiedMemberIds: e.tiedMemberIds,
      maxVotes: e.maxVotes,
    })),
  });
};

