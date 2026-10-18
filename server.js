const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connecteDB = require("./src/config/db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/auth", require("./src/routes/auth"));
app.use("/events", require("./src/routes/events"));
app.use("/bookings", require("./src/routes/bookings"));

const startServer = async () => {   
    try {
        await connecteDB();
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();