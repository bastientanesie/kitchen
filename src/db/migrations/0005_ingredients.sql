CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  present INTEGER NOT NULL DEFAULT 0,
  storage TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (household_id, name)
);

CREATE INDEX idx_ingredients_household_id ON ingredients(household_id);
