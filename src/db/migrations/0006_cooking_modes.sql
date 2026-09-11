CREATE TABLE cooking_modes (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  present INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (household_id, name)
);

CREATE INDEX idx_cooking_modes_household_id ON cooking_modes(household_id);
