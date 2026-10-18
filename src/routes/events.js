
const router = require("express").Router();
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const { authenticate, authorize } = require("../middleware/auth");
const { emailQueue } = require("../queue");

// ----- Public Routes -----

router.get("/", async (req, res) => {
    const events = await Event.find();
    res.json(events);
});

router.get("/:id", async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) {
        return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
});

// ----- Organizer Routes -----

router.post("/", authenticate, authorize("organizer"), async (req, res) => {
  const { title, description, date, totalSeats } = req.body;
  if (!title || !date || !totalSeats) {
    return res.status(400).json({ message: "title, date and totalSeats are required" });
  }
  const event = await Event.create({
    title, description, date, totalSeats,
    availableSeats: totalSeats,
    organizer: req.user.id,
  });
  res.status(201).json(event);
});

router.put("/:id", authenticate, authorize("organizer"), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: "Event not found" });
  if (event.organizer.toString() !== req.user.id) {
    return res.status(403).json({ message: "Not your event" });
  }

  const { title, description, date } = req.body;
  if (title) event.title = title;
  if (description) event.description = description;
  if (date) event.date = date;
  await event.save();

  // Background job: the worker emails every customer who booked
  await emailQueue.add("event-updated", { eventId: event._id.toString() });

  res.json(event);
});

router.delete("/:id", authenticate, authorize("organizer"), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: "Event not found" });
  if (event.organizer.toString() !== req.user.id) {
    return res.status(403).json({ message: "Not your event" });
  }
  await event.deleteOne();
  res.json({ message: "Event deleted" });
});

router.get("/:id/bookings", authenticate, authorize("organizer"), async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: "Event not found" });
  if (event.organizer.toString() !== req.user.id) {
    return res.status(403).json({ message: "Not your event" });
  }
  const bookings = await Booking.find({ event: event._id });
  res.json(bookings);
});

// ---------- Customer only: NAIVE booking ----------

router.post("/:id/book", authenticate, authorize("customer"), async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10) || 1;
  if (quantity < 1) return res.status(400).json({ message: "Invalid quantity" });

  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: "Event not found" });

  if (event.availableSeats < quantity) {
    return res.status(409).json({ message: "Not enough seats" });
  }
  event.availableSeats = event.availableSeats - quantity;
  await event.save();

  const booking = await Booking.create({ event: event._id, user: req.user.id, quantity });

  // Background job: the worker sends the confirmation email
  await emailQueue.add("booking-confirmation", { bookingId: booking._id.toString() });

  res.status(201).json(booking);
});

module.exports = router;