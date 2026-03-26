

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri =
      "mongodb+srv://hamza:hamza123@webnode.7otfcpv.mongodb.net/voting_app";

    console.log("Connecting to:", uri);

    await mongoose.connect(uri);

    console.log("MongoDB connected");
  } catch (err) {
    console.error("DB ERROR:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;