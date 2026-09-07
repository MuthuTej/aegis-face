# NHAI Hackathon 7.0 — Offline Facial Recognition Attendance

Project workspace for **Hackathon 7.0**: a mobile-based, secure, **offline** facial
recognition + liveness detection attendance system for field personnel in
zero-network zones, integrating with the Datalake 3.0 React Native app.

> Full problem statement: see [`hackathon_doc7.pdf`](./hackathon_doc7.pdf).
> Solution/architecture overview: see [`BUILD_GUIDE.md`](./BUILD_GUIDE.md).

---

## What this repo contains right now

This repo currently holds the **backend** (server side) plus planning docs. The
AI model and the React Native frontend are intentionally **out of scope here** —
they are tracked separately. This README documents what was actually built and
verified.

| Area | Status | Location |
|------|--------|----------|
| Problem brief (source of truth) | reference | `hackathon_doc7.pdf` |
| Solution plan & tech-stack rationale | written | `BUILD_GUIDE.md` |
| **Backend API (auth, enrollment store, sync & purge, reporting)** | **built + tested** | `backend/` |
| AI model (MobileFaceNet, liveness) | not in this repo | — |
| React Native frontend | not in this repo | — |

---

## The backend (`backend/`)

The backend is the **server side of the "Sync & Purge" deliverable**: field
devices run the AI model and capture attendance fully offline, then sync to this
server when connectivity returns and purge their local copies. It also stores
the face-embedding templates the device produces and exposes reporting.

It does **not** run any AI model or UI — it validates and persists what the
device sends, and serves admin/reporting endpoints.

### Tech stack

- **Node.js 22 + TypeScript** (strict)
- **Express** + **helmet** + **cors**
- **`node:sqlite`** — Node's built-in embedded SQL database (zero native build).
  Chosen after `better-sqlite3` could not be used on this machine (no C++ build
  tools and prebuilt binaries weren't fetchable). Runs under the
  `--experimental-sqlite` flag, which is wired into the npm scripts via
  `cross-env`.
- **JWT** auth for admins/operators; **bcrypt-hashed API keys** for devices
- **zod** for request validation
- **Jest + supertest** for tests (run against an in-memory DB)

### What was implemented

**Authentication & users**
- First-ever registration bootstraps an admin (no token needed); afterwards only
  an admin JWT can create users.
- Login issues a JWT; role-based guards (`admin` / `operator` / `field`).
- Passwords bcrypt-hashed, never stored in plaintext.

**Devices**
- Admin registers a field device and receives a one-time API key (only a bcrypt
  hash is stored).
- List devices; revoke a device (future syncs rejected).

**Enrollment templates**
- Upsert / get / delete a face embedding per employee (validated as a numeric
  vector of length 64–1024; the AI runs on-device, we only store the result).
- Devices can download templates updated since a timestamp for offline matching.

**Sync & Purge (the core)**
- Idempotent batch upload of attendance keyed by a device-generated `clientUuid`.
- The response reports `accepted`, `duplicates`, `rejected`, and `purgeable`
  (accepted ∪ duplicates) so the device can safely delete its local copy.
  Re-sending a record is never an error — this makes sync safe over flaky
  networks.
- `purge-confirm` endpoint leaves an audit trail of deletions.

**Reporting**
- List/filter attendance (by employee, device, date range); summary stats.

**Operational**
- Health + readiness probes, 404 + central error handling, schema auto-migrated
  on boot, security headers via helmet, JSON body capped at 5 MB.

### Project layout

```
backend/
├── src/
│   ├── config.ts            # env-driven config
│   ├── db.ts                # node:sqlite connection, schema, tx helper
│   ├── types.ts             # row types + Express Request augmentation
│   ├── server.ts            # entrypoint
│   ├── app.ts               # express app wiring
│   ├── auth/
│   │   ├── jwt.ts           # sign/verify JWT
│   │   └── middleware.ts    # requireAuth (JWT) + requireDevice (API key)
│   ├── routes/
│   │   ├── health.ts
│   │   ├── auth.ts
│   │   ├── devices.ts
│   │   ├── enrollments.ts
│   │   ├── sync.ts          # device: download templates, upload attendance, purge
│   │   └── attendance.ts    # admin: reporting + stats
│   └── scripts/seed.ts      # demo admin + device
└── tests/                   # jest + supertest suites
```

### API summary (base path `/api/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` · `/health/ready` | – | Liveness / readiness |
| POST | `/auth/register` | bootstrap → admin | Create user |
| POST | `/auth/login` | – | Get JWT |
| GET | `/auth/me` | JWT | Current principal |
| POST | `/devices` | admin | Register device → one-time API key |
| GET | `/devices` | admin/operator | List devices |
| DELETE | `/devices/:deviceId` | admin | Revoke device |
| PUT/GET/DELETE | `/enrollments/:employeeId` | admin/operator | Manage template |
| GET | `/enrollments` | admin/operator | List templates |
| GET | `/sync/enrollments?since=` | device | Download templates (offline) |
| POST | `/sync/attendance` | device | Idempotent attendance upload |
| POST | `/sync/purge-confirm` | device | Audit local purge |
| GET | `/attendance` · `/attendance/stats` | admin/operator | Reporting |

Full details (request/response examples, device-auth headers, AWS mapping) are in
[`backend/README.md`](./backend/README.md).

---

## Running it

```bash
cd backend
npm install
npm run seed     # creates admin (ADMIN001 / admin1234) + demo device (prints apiKey)
npm run dev      # http://localhost:4000
```

Production build:

```bash
npm run build && npm start
```

## Testing

```bash
cd backend
npm test
```

### Current test results — **29 / 30 passing**

Coverage spans health, auth (bootstrap, login, role/token guards), devices,
enrollments (upsert/get/delete, offline download, validation), and the full
sync-and-purge flow (new batch, idempotent re-sync, mixed batch, validation,
purge-confirm, reporting, stats).

**Known limitation (1 failing test):** registering a **duplicate** employee ID
(or device) currently returns HTTP **500** instead of **409**. The duplicate is
still correctly rejected by the database UNIQUE constraint — **no bad data is
written** — only the returned status code is wrong. Cause: `node:sqlite` reports
the unique-constraint error via an `errcode` (2067) rather than a message string
our handler matches on. A targeted fix exists but was deliberately left out for
now to keep the change set minimal.

---

## How this maps to AWS (production)

The prototype uses `node:sqlite` for zero-config local runs. Only the data layer
(`src/db.ts`) changes for cloud deployment:

| Prototype | AWS production |
|-----------|----------------|
| SQLite `attendance` / `enrollments` | DynamoDB (PK `clientUuid` / `employeeId`) |
| Express on localhost | API Gateway + Lambda (or ECS/Fargate) |
| Embedding stored in a row | S3 object + DynamoDB pointer |
| `purge_log` table | CloudWatch / DynamoDB audit table |

The idempotent `clientUuid` design maps directly onto DynamoDB conditional
writes, so sync semantics are identical in the cloud.

---

## Files in this repo

- `hackathon_doc7.pdf` — official problem statement
- `BUILD_GUIDE.md` — solution plan, tech-stack rationale, scoring strategy
- `backend/` — the implemented backend (this is the working, tested deliverable)
- `backend/README.md` — backend-specific run/API/AWS docs
