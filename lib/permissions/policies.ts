import 'server-only';

/**
 * Permission policy primitives.
 *
 * A Policy is a pure function: given a subject (current user + role) and an
 * entity, return whether an action is allowed. Policies live close to the
 * entity they govern (one file per entity type) so they can be inspected
 * without grep-archeology.
 *
 * The framework does NOT replace `requireRole` — workspace-level role gates
 * still happen first. Policies refine inside the workspace ("you're a
 * member, but can you delete this specific todo?").
 */

export type SubjectRole = 'owner' | 'admin' | 'member' | 'guest';

export type Subject = {
  userId: string;
  workspaceId: string;
  role: SubjectRole;
};

export type Decision =
  | { ok: true }
  | { ok: false; reason: string };

export type Policy<E, A extends string = string> = (
  subject: Subject,
  entity: E,
  action: A
) => Decision;

export const ALLOW: Decision = { ok: true };
export const deny = (reason: string): Decision => ({ ok: false, reason });

/**
 * Compose multiple policies — first-deny-wins. Useful when an entity has
 * cross-cutting policy concerns (e.g. private flag AND scope-based).
 */
export function all<E, A extends string>(
  ...policies: Policy<E, A>[]
): Policy<E, A> {
  return (s, e, a) => {
    for (const p of policies) {
      const r = p(s, e, a);
      if (!r.ok) return r;
    }
    return ALLOW;
  };
}

/**
 * Convenience: rank role for "at-least-X" comparisons.
 */
const ROLE_RANK: Record<SubjectRole, number> = {
  guest: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(subject: Subject, min: SubjectRole): boolean {
  return ROLE_RANK[subject.role] >= ROLE_RANK[min];
}

/**
 * Imperative gate. Throws on deny — server actions catch the AuthError and
 * return a structured Result.
 */
export class AuthError extends Error {
  constructor(public readonly reason: string) {
    super(`Forbidden: ${reason}`);
    this.name = 'AuthError';
  }
}

export function assertCan<E, A extends string>(
  policy: Policy<E, A>,
  subject: Subject,
  entity: E,
  action: A
): void {
  const r = policy(subject, entity, action);
  if (!r.ok) throw new AuthError(r.reason);
}
