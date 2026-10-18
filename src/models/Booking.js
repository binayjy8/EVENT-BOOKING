const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  quantity: { type: Number, required: true, min: 1 },
  status: { type: String, default: "confirmed" },
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);