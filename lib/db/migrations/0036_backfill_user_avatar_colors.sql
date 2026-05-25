-- Backfill: every existing user inherited the schema-default
-- (#5eb6ff / #0369a1) because no signup path ever assigned colors.
-- That's why every user shows up identical in Members tabs, todo
-- assignee chips, owner pickers, etc. Map each affected user to one
-- of the 10 palette slots via a stable hash of their id, so they
-- stay on the same color across sessions.
WITH picks AS (
  SELECT id, (abs(hashtext(id)) % 10) AS i FROM users WHERE avatar_from = '#5eb6ff'
)
UPDATE users
SET
  avatar_from = (ARRAY[
    '#7C5CFF', '#5E9EFF', '#FF8A5C', '#5FCFA8', '#E8B86D',
    '#B86DDB', '#FFB85C', '#6DDBDB', '#DB6D8A', '#8A8A8A'
  ])[picks.i + 1],
  avatar_to = (ARRAY[
    '#5740B3', '#4072B3', '#B36140', '#3F8E74', '#A37F4B',
    '#7F4998', '#B37F3F', '#479898', '#984B5F', '#5F5F5F'
  ])[picks.i + 1]
FROM picks
WHERE users.id = picks.id;
