-- Todo subgroups: a self-referential parent on todo_groups enables one
-- level of nesting (e.g. "Fleet OS" → "Native App"). ON DELETE SET NULL
-- promotes orphaned subgroups to top-level rather than cascading the
-- delete into their todos. The one-level-depth invariant (a subgroup
-- cannot itself have children) is enforced in the action layer, not in
-- SQL — a reliable self-join depth CHECK isn't worth the complexity here.

ALTER TABLE "todo_groups"
  ADD COLUMN IF NOT EXISTS "parent_group_id" uuid
  REFERENCES "todo_groups"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "todo_groups_parent_idx"
  ON "todo_groups" ("workspace_id", "parent_group_id", "position");
