import { AppUser } from '../db.js';

const norm = (s?: string | null) => (s || '').trim().toLowerCase();

/** Admin sees everything. Everyone else sees only entries that touch their own location. */
export function canSee(
  user: AppUser,
  e: { location?: string; from_branch?: string; to_branch?: string }
): boolean {
  if (user.role === 'admin') return true;
  const loc = norm(user.location);
  return [e.location, e.from_branch, e.to_branch].some(x => norm(x) === loc);
}

/** The branch the material is going TO (receives it / sends it back). */
export function isDestination(user: AppUser, e: { to_branch?: string }): boolean {
  return user.role === 'admin' || norm(e.to_branch) === norm(user.location);
}

/** The branch the material came FROM (sender, receives it back). */
export function isOrigin(user: AppUser, e: { from_branch?: string; location?: string }): boolean {
  return user.role === 'admin' || norm(e.from_branch || e.location) === norm(user.location);
}

/** Admins may pick a location; everyone else is forced to their own. */
export function effectiveLocation(user: AppUser, requested?: string): string | undefined {
  if (user.role === 'admin') return requested && requested !== 'ALL' ? requested : undefined;
  return user.location;
}
