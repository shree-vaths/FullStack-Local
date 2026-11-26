# Users & Transactions

A small full-stack app: a sortable, paginated table of users. Click a user to see their transactions in the same table component.

- **server/**: REST API. Express 5 + TypeScript + SQLite (`better-sqlite3`)
- **client/**: UI. React 19 + TypeScript + Vite + Tailwind CSS

The two are independent packages, each with its own `package.json`, `tsconfig.json` and `node_modules`. They only share the API contract in `src/types.ts`; see [Keeping types in sync](#keeping-types-in-sync).

---

## Quick start

### 1. Prerequisites

- **Node.js 24** (pinned in the repository's root [`.nvmrc`](../.nvmrc); nvm also finds it from any subfolder). With [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  nvm install 24   # first time only
  nvm use          # in each new terminal (or `nvm use 24` outside this repo)
  ```
  > Node 20 is end-of-life and won't work: `better-sqlite3` has no prebuilt binary for it.
- npm 10+ (comes with Node)

### 2. Install

```bash
cd server
npm install

cd ../client
npm install
```

The repository includes a ready-made database, `server/data/app.db` (100 users, 1500 transactions), so no seeding is needed. To reset it to fresh sample data at any time, run `npm run seed` in `server/`. The data is the same on every run.

### 3. Run (two terminals)

```bash
# Terminal 1: API on http://localhost:3001
cd server && nvm use && npm run dev

# Terminal 2: UI on http://localhost:5173
cd client && nvm use && npm run dev
```

Open **http://localhost:5173**. The Vite dev server forwards `/api/*` to the API, so the browser sees a single origin and no CORS setup is needed.

Both dev servers reload automatically when you change a file.

### 4. Test

```bash
cd server && npm test     # API, pagination, failure handling (in-memory SQLite)
cd client && npm test     # components, hooks, HTTP client, whole-app flows (jsdom)
```

---

## Scripts

Run these inside `server/` or `client/`.

| Script | server/ | client/ |
|---|---|---|
| `npm run dev` | API with auto-reload (`tsx watch`) | Vite dev server with hot reload |
| `npm start` | API without auto-reload | – |
| `npm run seed` | Reset the DB with fresh sample data | – |
| `npm run build` | – | Type-check and build to `client/dist/` |
| `npm run preview` | – | Serve the built `dist/` locally |
| `npm test` / `npm run test:watch` | Vitest + Supertest | Vitest + Testing Library |


## Configuration

All settings are optional; the defaults work for local development.

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | Port the API listens on |
| `DATABASE_PATH` | server, seed | `server/data/app.db` | SQLite file (created if missing) |
| `API_URL` | client (dev proxy) | `http://localhost:3001` | Where `/api` is forwarded |

Example: `PORT=4000 npm run dev` in `server/` and `API_URL=http://localhost:4000 npm run dev` in `client/`.

---

## API

Base path `/api`. All responses are JSON.

| Method & path | Returns |
|---|---|
| `GET /api/health` | `{ data: { status, database } }`, or `503` if the DB is unreachable |
| `GET /api/users` | A page of users |
| `GET /api/users/:id` | One user, or `404` |
| `GET /api/users/:id/transactions` | A page of that user's transactions, or `404` for an unknown user |

**Pagination and sorting:** both list endpoints accept these query parameters.

| Param | Default | Allowed |
|---|---|---|
| `page` | `1` | integer ≥ 1 (a page past the end returns an empty list) |
| `pageSize` | `20` | 1–100 |
| `sortBy` | users: `id` · transactions: `serviceDate` | users: `id`, `name`, `registrationDate` · transactions: `id`, `serviceDate`, `priceCents` |
| `sortOrder` | users: `asc` · transactions: `desc` | `asc`, `desc` |

```bash
curl "http://localhost:3001/api/users?page=2&pageSize=5&sortBy=name&sortOrder=desc"
```
```json
{
  "data": [{ "id": 94, "name": "Trudie Goldner", "registrationDate": "2023-06-20", "country": "Hungary", "serviceLevel": "basic" }],
  "pagination": { "page": 2, "pageSize": 5, "totalItems": 100, "totalPages": 20 }
}
```

**Errors** always have the same shape: `{ "error": { "code": "...", "message": "..." } }`.

| Status | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad id or query parameter; the message names each bad field |
| 404 | `NOT_FOUND` | Unknown user or route |
| 503 | `DATABASE_UNAVAILABLE` | Temporary (DB busy or closing). Has a `Retry-After` header; the client retries automatically |
| 500 | `DATABASE_ERROR` / `INTERNAL_ERROR` | Permanent failure. Details are logged on the server, never sent to the client |

**Data notes:** prices are integer **cents** (`priceCents: 12345` = $123.45), to avoid floating-point rounding errors. Dates are ISO `YYYY-MM-DD` strings.

---

## Project structure

```
cofactor_local/
├── server/
│   ├── src/
│   │   ├── index.ts            # process entry: open DB, listen, graceful shutdown
│   │   ├── app.ts              # builds the Express app (wires db → repos → services → routes)
│   │   ├── config.ts           # the only place that reads env vars
│   │   ├── types.ts            # API contract (KEEP IN SYNC with client)
│   │   ├── pagination.ts       # page types + page math
│   │   ├── db/                 # connection, schema.sql, seed, SQLite error translation
│   │   ├── repositories/       # all SQL lives here; maps rows → domain types
│   │   ├── services/           # business rules (e.g. unknown user → 404)
│   │   ├── routes/             # HTTP only: validate (zod) → service → JSON
│   │   ├── middleware/         # single error handler
│   │   └── errors/             # AppError, NotFoundError, ValidationError, DatabaseError
│   └── tests/
└── client/
    └── src/
        ├── App.tsx             # layout + selected-user state
        ├── types.ts            # API contract (copy of server/src/types.ts)
        ├── api/                # httpClient (all fetch calls), usersApi (one function per endpoint)
        ├── hooks/              # useListParams (page/sort), usePaginatedFetch (loading/race-safety)
        ├── components/         # generic: DataTable, Pagination, ErrorMessage
        ├── features/           # domain screens: users/UsersTable, transactions/TransactionsPanel
        └── lib/format.ts       # money/date formatting
```

### How a request flows

```
UsersTable ──(page/sort)──▶ usePaginatedFetch ──▶ usersApi ──▶ httpClient ── GET /api/users?… ──┐
                                                                                                 ▼
JSON ◀── route (zod validation) ◀── userService ◀── userRepository (parameterized SQL) ◀── SQLite
```

- **Sorting and pagination run on the server**, because the client only ever has one page. `DataTable` never reorders rows itself: it shows the current sort and asks its parent to change it.
- **One generic `DataTable`** renders both the users list and the transactions list; each just passes a different column config.

---

## Common tasks

**Add a sortable column**
1. Server: add the field to `USER_SORT_FIELDS` (or `TRANSACTION_SORT_FIELDS`) in `server/src/types.ts`, and its SQL expression to `SORT_COLUMNS` in the matching repository.
2. Client: make the same change in `client/src/types.ts`, then add `sortField` to the column in `features/.../*.tsx`.

**Add an endpoint:** repository method → service method → route (validate with a zod schema in `routes/validation.ts`) → a function in `client/src/api/usersApi.ts`.

**Reset the data:** `npm run seed` in `server/`. It replaces everything in one transaction and generates the same data on every run (fixed random seed).

### Keeping types in sync

`server/src/types.ts` and `client/src/types.ts` are deliberate copies, so the two packages stay independent. **When you change one, change the other.** Nothing checks that they match. Options for automating this are listed in the design docs.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `NODE_MODULE_VERSION mismatch` or `better-sqlite3` fails to load | Wrong Node version: `nvm use`, then `rm -rf node_modules && npm install` in `server/` |
| `npm install` tries to compile `better-sqlite3` and fails | You're on Node < 22 (no prebuilt binary). Switch to Node 24 |
| `Fatal: port 3001 is already in use` | Another API instance is running. Stop it (Ctrl+C), or use `PORT=…` (and `API_URL` for the client) |
| `Warning: the database has no users` | Run `npm run seed` in `server/` |
| UI shows "The server is not responding" | The API isn't running. Start it in `server/` |
| `Fatal: … could not be initialised (corrupt file …)` | Delete `server/data/app.db*` and run `npm run seed` |

---

## Design decisions and known limitations

Design decisions, with the reasoning and alternatives behind each, are in `../docs/backend-decisions.txt` and `../docs/frontend-decisions.txt`.

Deliberate deviations and gaps:
- **1500 transactions instead of 1000.** Every user is guaranteed at least 10; with exactly 1000, all 100 users would get exactly 10 each, which makes unrealistic, uniform data.
- **No authentication or authorization:** anyone can read all users. This is the main security gap for a multi-tenant SaaS.
- **Offset pagination:** fine at this size; keyset (cursor) pagination is the path for large tables.
- **SQLite:** single file, one writer at a time. Fine locally; a server database would be needed for production scale.
- **Client:** page and sort aren't stored in the URL, there's no response caching, and locale/currency are fixed to en-US/USD.
