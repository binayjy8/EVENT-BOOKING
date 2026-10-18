const BASE = "https://event-booking-ksll.onrender.com";

const post = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  console.log(path, "->", r.status, text.slice(0, 200).replace(/\s+/g, " "));
  try { return JSON.parse(text); } catch { return {}; }
};

(async () => {
  const s = Date.now();
  const orgEmail = `load.org${s}@test.com`, custEmail = `load.cust${s}@test.com`;
  await post("/auth/register", { name: "Load Org", email: orgEmail, password: "Pass@1234", role: "organizer" });
  await post("/auth/register", { name: "Load Cust", email: custEmail, password: "Pass@1234", role: "customer" });
  const org = (await post("/auth/login", { email: orgEmail, password: "Pass@1234" })).token;
  const cust = (await post("/auth/login", { email: custEmail, password: "Pass@1234" })).token;
  const a = await post("/events", { title: "Load A", date: "2026-12-31", totalSeats: 100000 }, org);
  const b = await post("/events", { title: "Load B", date: "2026-12-31", totalSeats: 100 }, org);
  console.log("CUST_TOKEN=" + cust);
  console.log("EVENT_A=" + a._id);
  console.log("EVENT_B=" + b._id);
})();