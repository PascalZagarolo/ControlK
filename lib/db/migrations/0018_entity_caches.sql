-- Denormalized cache columns for cheap reads on list views.
-- Recomputed on-write by lib/db/cache-recompute.ts and via a nightly cron
-- to catch drift (drift is expected because some signals — message replies,
-- channel messages — are not all routed through actions that update caches).

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "cached_active_contract_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cached_open_todo_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cached_last_touchpoint_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "cached_utilization_30d_pct" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Backfill customers.cached_active_contract_count
UPDATE "customers" c
SET "cached_active_contract_count" = (
  SELECT COUNT(*) FROM "contracts" co
  WHERE co.customer_id = c.id AND co.status IN ('aktiv','auslaufend')
);
--> statement-breakpoint

-- Backfill customers.cached_open_todo_count
UPDATE "customers" c
SET "cached_open_todo_count" = (
  SELECT COUNT(*) FROM "todos" t
  WHERE t.customer_id = c.id AND t.status IN ('offen','in_arbeit')
);
--> statement-breakpoint

-- Backfill customers.cached_last_touchpoint_at — newest of:
-- contract createdAt, todo createdAt, customer_activity occurredAt
UPDATE "customers" c
SET "cached_last_touchpoint_at" = GREATEST(
  (SELECT MAX(co.created_at) FROM "contracts" co WHERE co.customer_id = c.id),
  (SELECT MAX(t.created_at)  FROM "todos" t      WHERE t.customer_id = c.id),
  (SELECT MAX(a.occurred_at) FROM "customer_activity" a WHERE a.customer_id = c.id)
);
--> statement-breakpoint

-- Backfill vehicles.cached_utilization_30d_pct
-- Count days a contract covers (intersected with the last 30 days) / 30
UPDATE "vehicles" v
SET "cached_utilization_30d_pct" = LEAST(100, GREATEST(0, (
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (
      LEAST(co.ends_at,   now())
      -
      GREATEST(co.starts_at, now() - interval '30 days')
    )) / 86400.0
  ), 0)::int * 100 / 30
  FROM "contracts" co
  WHERE co.vehicle_id = v.id
    AND co.status <> 'storniert'
    AND co.starts_at IS NOT NULL
    AND co.ends_at   IS NOT NULL
    AND co.ends_at   >  now() - interval '30 days'
    AND co.starts_at <  now()
)));
