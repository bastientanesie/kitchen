CREATE TABLE invitations (
  token_hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_invitations_household_id ON invitations(household_id);
