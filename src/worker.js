const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();
const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const { connection } = require("./queue");
const { sendMail } = require("./config/mailer");
const Booking = require("./models/Booking");
const Event = require("./models/Event");
const User = require("./models/User");

const handlers = {
  "booking-confirmation": async (data) => {
    console.log("Job data:", data);
    const booking = await Booking.findById(data.bookingId);
    if (!booking) { console.log("Booking not found:", data.bookingId); return; }

    const user = await User.findById(booking.user);
    const event = await Event.findById(booking.event);
    if (!user || !user.email) { console.log("User/email missing for booking:", data.bookingId); return; }

    await sendMail(
      user.email,
      "Booking confirmed",
      `You booked ${booking.quantity} ticket(s) for "${event ? event.title : "your event"}".`
    );
  },

  "event-updated": async (data) => {
    console.log("Job data:", data);
    const event = await Event.findById(data.eventId);
    if (!event) { console.log("Event not found:", data.eventId); return; }

    const userIds = await Booking.distinct("user", { event: data.eventId });
    const users = await User.find({ _id: { $in: userIds } });
    for (const u of users) {
      if (!u.email) continue;
      await sendMail(u.email, "Event updated", `"${event.title}" has been updated. Check the new details.`);
    }
  },
};

const start = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  new Worker("emails", (job) => handlers[job.name](job.data), { connection, concurrency: 5 })
    .on("completed", (job) => console.log("Done:", job.name, job.id))
    .on("failed", (job, err) => console.log("Failed:", job?.name, job?.id, err.message));
  console.log("Worker running");
};
start();