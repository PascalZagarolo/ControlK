-- Notes full-text search. `search_text` holds a plain-text flattening of the
-- block document (maintained in the app on every save). A GIN index over a
-- German tsvector of title + search_text powers content search. Existing
-- notes are searchable by title immediately; their content becomes
-- searchable the next time they're saved (search_text backfills lazily).

ALTER TABLE "notes"
  ADD COLUMN IF NOT EXISTS "search_text" text;

CREATE INDEX IF NOT EXISTS "notes_fts_idx"
  ON "notes"
  USING GIN (to_tsvector('german', coalesce("title", '') || ' ' || coalesce("search_text", '')));
