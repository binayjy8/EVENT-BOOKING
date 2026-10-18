# Event Booking System (Backend)

Backend APIs for an event booking platform with two roles: **Organizers** manage events, **Customers** browse events and book tickets.

- **Live API:** https://event-booking-ksll.onrender.com (`/health` returns `{"status":"ok"}`)
- **Code:** https://github.com/binayjy8/EVENT-BOOKING
- **Naive version tag:** `naive-v1`

## Stack and why

| Choice | Reason |
|---|---|
| Node.js + Express | Familiar (MERN), fast to build |
| MongoDB Atlas + Mongoose | Flexible schema, free tier, atomic single-document updates |
| JWT + bcrypt | Stateless auth; role stored in the token |
| BullMQ + Upstash Redis | Durable job queue with retries and backoff |
| Brevo SMTP + Nodemailer | Real emails (not console logs) |
| Render | Long-running process, so the queue worker can run |

## Roles and access control

`authenticate` verifies the JWT. `authorize("organizer" | "customer")` rejects other roles with **403**; a missing or invalid token gives **401**. Organizers can only change or view bookings of **their own** events (otherwise 403 "Not your event").

## API

| Method | Path | Role |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/events`, `/events/:id` | public |
| POST | `/events` | organizer |
| PUT | `/events/:id` (triggers update notification job) | organizer (owner) |
| DELETE | `/events/:id` | organizer (owner) |
| GET | `/events/:id/bookings` | organizer (owner) |
| POST | `/events/:id/book` (triggers confirmation job) | customer |
| GET | `/bookings/me` | customer |
| GET | `/health` | public |

## Background tasks

Both run in a BullMQ worker (`src/worker.js`) with 3 attempts and exponential backoff.

1. **Booking confirmation:** after a successful booking, the API enqueues `booking-confirmation`; the worker emails the customer through Brevo.
2. **Event update notification:** after an event update, the API enqueues `event-updated`; the worker finds every customer with a booking for that event and emails each one.

The API only adds a job and replies immediately, so request latency does not depend on the email provider.

## Design decisions

- **Two-phase build:** a deliberately naive version first (tag `naive-v1`: read seats, check in JS, save, send email inside the request), then optimization, so the improvement can be measured.
- **Self-assigned roles at registration** is a shortcut for this test. In production, organizer accounts would need approval.
- **API and worker share one Render service** (`start.js`), because the free tier has no free background worker. In production they would be separate services.
- **SMTP port 2525**, because Render's free tier blocks ports 25, 465 and 587.
- **`SKIP_EMAIL=1`** disables real sending during load tests so they do not exhaust the Brevo daily limit or spam an inbox.
- **Known limitation:** the sender is a Gmail address verified in Brevo, which has no DKIM/DMARC alignment, so mail may land in spam. A custom domain would fix this.
- **Upstash eviction policy** should be set to `noeviction` for BullMQ.

## Performance

### Problem in the naive booking

```
read event -> check availableSeats in JS -> write new count -> send email
```

Under concurrency, two requests can read the same seat count and both succeed, so seats are oversold and one decrement is lost. Sending the email inside the request also makes latency depend on SMTP.

### Optimizations

| Change | Effect |
|---|---|
| Atomic `findOneAndUpdate({availableSeats: {$gte: qty}}, {$inc: {availableSeats: -qty}})` | Check and decrement in one operation; removes the race condition |
| Email moved to the BullMQ worker | Fast responses; retries on failure |
| Indexes on `Booking.event`, `Booking.user`, `Event.organizer` | Faster lookups for the notification fan-out and `/bookings/me` |
| `.lean()` on read endpoints | Less memory and CPU per read |
| Rate limiting and idempotency key (planned) | Protects the API; prevents double booking on retries |

### Load test method

Tool: `autocannon`, against the deployed URL, with `SKIP_EMAIL=1`.

```
npx autocannon -c <connections> -d 10 -m POST \
  -H "Authorization=Bearer <customer token>" -H "Content-Type=application/json" \
  -b '{"quantity":1}' https://event-booking-ksll.onrender.com/events/<id>/book
```

Concurrency was raised (10, 50, 100, 200, 400) until errors or timeouts appeared. A second test sent 300 bookings against a 100-seat event to check for overselling.

### Results

> Fill these in with your measured numbers before submitting. Do not leave estimates.

| | Naive | Optimized |
|---|---|---|
| Concurrency where errors/timeouts began | ___ | ___ |
| Requests/sec at that point | ___ | ___ |
| p99 latency | ___ | ___ |
| Bookings accepted for 100 seats (300 attempts) | ___ | exactly 100 |

## Status and honesty notes

- Locally, the full flow works: roles, booking, both background emails.
- On the deployed Render service, `/health`, register and login work. At the time of writing, `POST /events` returned a 500 that was still under investigation (see Render logs), which limited the deployed load test.
- Not completed in the time available: rate limiting, idempotency key, separate worker service.

## Run locally

```bash
npm install
# .env: PORT, MONGO_URI, JWT_SECRET, REDIS_URL, BREVO_USER, BREVO_KEY, MAIL_FROM
npm start          # API + worker
```
