-- Schema for the users / transactions app.
-- Dates are stored as ISO-8601 TEXT (YYYY-MM-DD): SQLite has no native date type,
-- and ISO strings sort correctly as text and work with SQLite's date functions.

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  registration_date TEXT    NOT NULL,
  country           TEXT    NOT NULL,
  service_level     TEXT    NOT NULL
                    CHECK (service_level IN ('basic', 'premium', 'elite'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- No services table was specified, so service_id is a plain identifier for now.
  service_id    INTEGER NOT NULL,
  -- Money as integer cents avoids floating-point rounding (e.g. 0.1 + 0.2).
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  service_date  TEXT    NOT NULL
);

-- "Transactions for a user" is our main query; without this index it is a full table scan.
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
