const router = require("express").Router();
const Booking = require("../models/Booking");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/me", authenticate, authorize("customer"), async (req, res) => {
    const bookings = await Booking.find({ user: req.user.id }).populate("event", "title date");
    res.json(bookings);
});
    
module.exports = router;