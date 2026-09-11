CREATE TABLE device_link_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  device_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_device_link_tokens_user_id ON device_link_tokens(user_id);
