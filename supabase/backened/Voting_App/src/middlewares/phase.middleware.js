module.exports = (requiredPhase) => async (req, res, next) => {
  const election = await Election.findOne({ isActive: true });

  if (election.currentPhase !== requiredPhase) {
    return res.status(400).json({ message: "Wrong phase" });
  }

  req.election = election;
  next();
};