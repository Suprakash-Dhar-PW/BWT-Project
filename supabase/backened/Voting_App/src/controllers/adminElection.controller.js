const Election = require("../models/election.model");
const Nomination = require("../models/nomination.model");
const Vote = require("../models/vote.model");
const Member = require("../models/member.model");
const ElectedMember = require("../models/electedMember.model");

const positionOrder = ["PRESIDENT", "SECRETARY", "TREASURER"];

function normalizePosition(position) {
  const p = String(position || "").toUpperCase();
  if (p === "PRESIDENT" || p === "SECRETARY" || p === "TREASURER") return p;
  return null;
}

async function getNomineesForPosition(position) {
  // Only include active members for nomination display.
  const nominations = await Nomination.find({ position, approved: true }).populate({
    path: "memberId",
    match: { isActive: true },
    select: "name email phone isActive can_vote isAdmin",
  });

  // populate match will leave nulls when inactive; filter them out.
  const filtered = nominations.filter((n) => n.memberId);
  return filtered.map((n) => ({
    nominationId: n._id,
    nomineeMemberId: n.memberId._id,
    nominee: n.memberId,
  }));
}

async function getVoteCountsForSession(election) {
  const voteCounts = await Vote.aggregate([
    { $match: { electionId: election._id, role: election.position } },
    { $group: { _id: "$candidateId", voteCount: { $sum: 1 } } },
  ]);

  const voteCountMap = new Map(
    voteCounts.map((r) => [String(r._id), Number(r.voteCount)])
  );

  const nominees = await getNomineesForPosition(election.position);

  const nomineesWithCounts = nominees.map((n) => ({
    nominationId: n.nominationId,
    nomineeMemberId: n.nomineeMemberId,
    nominee: n.nominee,
    voteCount: voteCountMap.get(String(n.nomineeMemberId)) ?? 0,
  }));

  const maxVotes =
    nomineesWithCounts.length > 0
      ? Math.max(...nomineesWithCounts.map((x) => x.voteCount))
      : 0;

  const tiedNominees = nomineesWithCounts
    .filter((x) => x.voteCount === maxVotes)
    .map((x) => x.nomineeMemberId);

  const isTie = tiedNominees.length > 1;

  return { nomineesWithCounts, maxVotes, tiedNominees, isTie };
}

function getPositionIndex(position) {
  return positionOrder.indexOf(position);
}

async function assertNoActiveSession() {
  const active = await Election.findOne({ status: "active" });
  if (active) {
    const err = new Error("Another voting session is active");
    err.statusCode = 400;
    throw err;
  }
}

async function assertPreviousDeclared(position) {
  const idx = getPositionIndex(position);
  if (idx <= 0) return;
  const prevPos = positionOrder[idx - 1];
  const prev = await Election.findOne({
    position: prevPos,
    status: "results_declared",
  });
  if (!prev) {
    const err = new Error(
      `Start ${position} only after ${prevPos} results are declared`
    );
    err.statusCode = 400;
    throw err;
  }
}

exports.startSession = async (req, res) => {
  const pos = normalizePosition(req.body.position);
  if (!pos) {
    return res.status(400).json({ message: "Invalid position" });
  }

  await assertNoActiveSession();
  await assertPreviousDeclared(pos);

  const nominees = await getNomineesForPosition(pos);
  if (!nominees.length) {
    return res.status(400).json({ message: `No nominees for ${pos}` });
  }

  const election = await Election.create({
    name: `Voting Session - ${pos}`,
    position: pos,
    status: "active",
    isTie: false,
    tiedNomineeIds: [],
    winnerUserId: null,
    declaredByUserId: null,
    maxVotes: 0,
  });

  res.status(201).json({
    sessionId: election._id,
    position: election.position,
    status: election.status,
    nominees,
  });
};

exports.endSession = async (req, res) => {
  const election = await Election.findOne({ status: "active" }).sort({ createdAt: -1 });
  if (!election) {
    return res.status(400).json({ message: "No active session" });
  }

  const { nomineesWithCounts, maxVotes, tiedNominees, isTie } =
    await getVoteCountsForSession(election);

  election.maxVotes = maxVotes;

  if (isTie) {
    election.status = "ended";
    election.isTie = true;
    election.tiedNomineeIds = tiedNominees;
    election.winnerUserId = null;
    election.declaredByUserId = null;
    await election.save();

    return res.json({
      sessionId: election._id,
      position: election.position,
      status: election.status,
      isTie: election.isTie,
      maxVotes,
      tiedNominees,
      nominees: nomineesWithCounts,
      message: "Tie detected. Admin must declare the winner soon.",
    });
  }

  const winnerId = tiedNominees[0]; // only one when !isTie
  election.status = "results_declared";
  election.isTie = false;
  election.tiedNomineeIds = [];
  election.winnerUserId = winnerId;
  election.declaredByUserId = req.user.id;
  await election.save();

  // Record elected member
  await ElectedMember.create({
    userId: winnerId,
    position: election.position,
    electionSessionId: election._id,
    declaredByUserId: req.user.id,
  });

  res.json({
    sessionId: election._id,
    position: election.position,
    status: election.status,
    isTie: false,
    maxVotes,
    winnerUserId: winnerId,
    nominees: nomineesWithCounts,
    message: "Winner declared automatically (no tie).",
  });
};

exports.getResults = async (req, res) => {
  const { sessionId } = req.params;
  const election = await Election.findById(sessionId);
  if (!election) return res.status(404).json({ message: "Session not found" });

  const { nomineesWithCounts, maxVotes, tiedNominees, isTie } =
    await getVoteCountsForSession(election);

  res.json({
    sessionId: election._id,
    position: election.position,
    status: election.status,
    isTie,
    maxVotes,
    tiedNominees,
    winnerUserId: election.winnerUserId,
    nominees: nomineesWithCounts,
  });
};

exports.declareWinner = async (req, res) => {
  const { sessionId, winnerUserId } = req.body;

  if (!sessionId || !winnerUserId) {
    return res.status(400).json({ message: "sessionId and winnerUserId are required" });
  }

  const election = await Election.findById(sessionId);
  if (!election) return res.status(404).json({ message: "Session not found" });
  if (election.status !== "ended" || !election.isTie) {
    return res.status(400).json({ message: "Winner can only be declared for tie sessions" });
  }

  const winnerIdStr = String(winnerUserId);
  const allowed = (election.tiedNomineeIds || []).map((x) => String(x));
  if (!allowed.includes(winnerIdStr)) {
    return res.status(400).json({
      message: "winnerUserId must be one of the tied nominees",
      allowedWinnerUserIds: election.tiedNomineeIds,
    });
  }

  election.status = "results_declared";
  election.isTie = false;
  election.winnerUserId = winnerUserId;
  election.declaredByUserId = req.user.id;
  election.tiedNomineeIds = [];
  await election.save();

  await ElectedMember.create({
    userId: winnerUserId,
    position: election.position,
    electionSessionId: election._id,
    declaredByUserId: req.user.id,
  });

  res.json({
    sessionId: election._id,
    position: election.position,
    status: election.status,
    winnerUserId,
    message: "Winner declared",
  });
};

exports.history = async (req, res) => {
  const elections = await Election.find({ status: "results_declared" }).sort({
    createdAt: -1,
  });

  res.json({
    history: await Promise.all(
      elections.map(async (e) => {
        const winner = e.winnerUserId
          ? await Member.findById(e.winnerUserId).select("name email phone")
          : null;

        return {
          sessionId: e._id,
          position: e.position,
          status: e.status,
          winnerUserId: e.winnerUserId,
          winner: winner ? { name: winner.name, email: winner.email, phone: winner.phone } : null,
          isTie: e.isTie,
          declaredByUserId: e.declaredByUserId,
          maxVotes: e.maxVotes,
          declaredAt: e.updatedAt || e.createdAt,
        };
      })
    ),
  });
};

