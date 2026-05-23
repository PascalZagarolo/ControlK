import 'server-only';
import { and, eq, sql, gt } from 'drizzle-orm';
import { getDb } from './client';
import * as s from './schema';

/**
 * On-write cache recompute helpers.
 *
 * Pattern: actions that mutate denormalized signals (contracts, todos, etc.)
 * call these AFTER the mutation has committed. They're tiny aggregations
 * scoped to a single entity and run unconditionally — if Postgres is
 * unreachable for some reason we swallow the error (the nightly drift-fix
 * cron compensates).
 */

export async function recomputeCustomerCache(customerId: string): Promise<void> {
  const db = getDb();
  try {
    await db.execute(sql`
      UPDATE "customers" c
      SET
        "cached_active_contract_count" = (
          SELECT COUNT(*) FROM "contracts" co
          WHERE co.customer_id = c.id AND co.status IN ('aktiv','auslaufend')
        ),
        "cached_open_todo_count" = (
          SELECT COUNT(*) FROM "todos" t
          WHERE t.customer_id = c.id AND t.status IN ('offen','in_arbeit')
        ),
        "cached_last_touchpoint_at" = GREATEST(
          (SELECT MAX(co.created_at) FROM "contracts" co WHERE co.customer_id = c.id),
          (SELECT MAX(t.created_at)  FROM "todos" t      WHERE t.customer_id = c.id),
          (SELECT MAX(a.occurred_at) FROM "customer_activity" a WHERE a.customer_id = c.id)
        )
      WHERE c.id = ${customerId};
    `);
  } catch (e) {
    console.warn('[cache-recompute] customer failed', customerId, e);
  }
}

export async function recomputeVehicleCache(vehicleId: string): Promise<void> {
  const db = getDb();
  try {
    await db.execute(sql`
      UPDATE "vehicles" v
      SET "cached_utilization_30d_pct" = LEAST(100, GREATEST(0, (
        SELECT COALESCE(SUM(
          EXTRACT(EPOCH FROM (
            LEAST(co.ends_at, now())
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
      )))
      WHERE v.id = ${vehicleId};
    `);
  } catch (e) {
    console.warn('[cache-recompute] vehicle failed', vehicleId, e);
  }
}

/**
 * Nightly drift-fix: rebuilds ALL caches in a workspace from scratch. Cheap
 * enough to run hourly even at 10k customers. Hooked into the existing
 * /api/cron/todo-rules cron or a new dedicated cron.
 */
export async function recomputeAllCachesForWorkspace(workspaceId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE "customers" c
    SET
      "cached_active_contract_count" = (
        SELECT COUNT(*) FROM "contracts" co
        WHERE co.customer_id = c.id AND co.status IN ('aktiv','auslaufend')
      ),
      "cached_open_todo_count" = (
        SELECT COUNT(*) FROM "todos" t
        WHERE t.customer_id = c.id AND t.status IN ('offen','in_arbeit')
      ),
      "cached_last_touchpoint_at" = GREATEST(
        (SELECT MAX(co.created_at) FROM "contracts" co WHERE co.customer_id = c.id),
        (SELECT MAX(t.created_at)  FROM "todos" t      WHERE t.customer_id = c.id),
        (SELECT MAX(a.occurred_at) FROM "customer_activity" a WHERE a.customer_id = c.id)
      )
    WHERE c.workspace_id = ${workspaceId};
  `);
  await db.execute(sql`
    UPDATE "vehicles" v
    SET "cached_utilization_30d_pct" = LEAST(100, GREATEST(0, (
      SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
          LEAST(co.ends_at, now()) - GREATEST(co.starts_at, now() - interval '30 days')
        )) / 86400.0
      ), 0)::int * 100 / 30
      FROM "contracts" co
      WHERE co.vehicle_id = v.id
        AND co.status <> 'storniert'
        AND co.starts_at IS NOT NULL AND co.ends_at IS NOT NULL
        AND co.ends_at > now() - interval '30 days'
        AND co.starts_at < now()
    )))
    WHERE v.workspace_id = ${workspaceId};
  `);
}
