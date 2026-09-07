# Datalake Backend — Offline Attendance Sync API

Backend for the NHAI Hackathon 7.0 offline facial-recognition attendance system.
It is the **server side** of the *Sync & Purge* requirement: field devices run the
AI model and capture attendance fully offline, then sync to this server when
connectivity returns and purge their local copies.

> This service does **not** run the AI model or any UI. It validates and stores
> the embeddings/attendance the device produces, and exposes reporting.

## Stack

- **Node.js 22 + TypeScript**
- **Express** (REST API) + **helmet** + **cors**
- **node:sqlite** — Node's built-in embedded SQL store, zero native build
  (swappable for DynamoDB/Postgres on AWS). Requires the `--experimental-sqlite`
  flag, wired into the npm scripts.
- **JWT** auth (admins/operators) + **bcrypt-hashed API keys** (devices)
- **zod** request validation
- **Jest + supertest** tests

## Run

```bash
cd backend
npm install
npm run seed     # creates admin (ADMIN001 / admin1234) + a demo device (prints apiKey)
npm run dev      # http://localhost:4000
```

Build & run production:

```bash
npm run build && npm start
```

## Test

```bash
npm test
```

Tests run against an in-memory SQLite DB (`DB_PATH=:memory:`), so they touch no
files and need no setup.

## API (base path `/api/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/health` · `/health/ready` | – | Liveness / readiness probes |
| POST | `/auth/register` | bootstrap → admin | Create user (first call bootstraps an admin) |
| POST | `/auth/login` | – | Get JWT |
| GET  | `/auth/me` | JWT | Current principal |
| POST | `/devices` | admin | Register a device, returns one-time `apiKey` |
| GET  | `/devices` | admin/operator | List devices |
| DELETE | `/devices/:deviceId` | admin | Revoke a device |
| PUT | `/enrollments/:employeeId` | admin/operator | Upsert face template (embedding) |
| GET | `/enrollments/:employeeId` | admin/operator | Read a template |
| DELETE | `/enrollments/:employeeId` | admin/operator | Delete a template |
| GET | `/enrollments` | admin/operator | List templates (metadata) |
| **GET** | **`/sync/enrollments?since=`** | **device** | Download templates for offline matching |
| **POST** | **`/sync/attendance`** | **device** | Idempotent batch attendance upload |
| **POST** | **`/sync/purge-confirm`** | **device** | Audit log that local data was purged |
| GET | `/attendance` | admin/operator | List/filter attendance |
| GET | `/attendance/stats` | admin/operator | Summary stats |

### Device authentication

Send two headers:

```
X-Device-Id: FIELD-DEVICE-01
X-Api-Key:   <key returned when the device was registered>
```

### The Sync & Purge contract

1. Device captures attendance offline; each record gets a client-generated `clientUuid`.
2. When online, it POSTs a batch to `/sync/attendance`.
3. The server **upserts idempotently** by `clientUuid` and replies:

   ```json
   {
     "accepted":   ["<uuid>"],
     "duplicates": ["<uuid>"],
     "rejected":   [],
     "purgeable":  ["<uuid>", "<uuid>"]
   }
   ```

4. Everything in `purgeable` (accepted ∪ duplicates) is durably stored, so the
   device safely **deletes its local copy**. Re-sending the same UUID is never an
   error — this makes sync safe over flaky networks.
5. Optionally the device calls `/sync/purge-confirm` to leave an audit trail.

### Example sync call

```bash
curl -X POST http://localhost:4000/api/v1/sync/attendance \
  -H "X-Device-Id: FIELD-DEVICE-01" \
  -H "X-Api-Key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"records":[{
        "clientUuid":"11111111-1111-1111-1111-111111111111",
        "employeeId":"EMP01",
        "capturedAt":"2026-06-04T09:00:00Z",
        "livenessPassed":true,
        "livenessMethod":"blink",
        "matchScore":0.93
      }]}'
```

## Mapping to AWS (production)

The prototype uses SQLite for zero-config local runs. The data layer in
`src/db.ts` is the only thing that changes for cloud deployment:

| Prototype | AWS production |
|-----------|----------------|
| SQLite `attendance` / `enrollments` tables | DynamoDB tables (PK `clientUuid` / `employeeId`) |
| Express on localhost | API Gateway + Lambda (or ECS/Fargate) |
| Raw embeddings in a row | S3 object + DynamoDB pointer |
| `purge_log` table | CloudWatch / DynamoDB audit table |

The idempotent `clientUuid` design maps directly onto DynamoDB conditional
writes, so the sync semantics are identical in the cloud.

## Security notes

- Passwords and device API keys are bcrypt-hashed (never stored in plaintext).
- API keys are shown exactly once at device registration.
- helmet sets hardened HTTP headers; JSON body capped at 5 MB.
- Set a strong `JWT_SECRET` in production (see `.env.example`).
