const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const EMAIL_QUEUE_NAME = "emails";
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
connection.on("error", (e) => console.log("Redis:", e.code || e.message));

const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

module.exports = { connection, emailQueue, EMAIL_QUEUE_NAME };
