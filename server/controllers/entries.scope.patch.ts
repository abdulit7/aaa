// ---- entries.controller.ts: changes that give you per-location data ----
import { canSee } from '../utils/scope.js';

// 1) list(): replace   let entries = await db.getEntries();   with:
const user = (req as AuthenticatedRequest).user!;
let entries = (await db.getEntries()).filter(e => canSee(user, e));
// and make the existing `location` query filter apply to admins only:
//   if (user.role === 'admin' && location && String(location) !== 'ALL') { ... }

// 2) getByCode(): right after the 404 check
if (!canSee((req as AuthenticatedRequest).user!, entry)) {
  return res.status(403).json({ success: false, error: 'Not allowed for your location' });
}

// 3) create(): do not trust location / from_branch from the client
const assignedLocation = user.role === 'admin'
  ? ((req.body.location && String(req.body.location).trim()) || user.location || '')
  : (user.location || '');
const actualFromBranch = isInterLocation ? assignedLocation : undefined;   // ignore body.from_branch
// validate the destination (send to_branch from a dropdown of /users/locations, not free text in `party`):
const known = db.getFacilityLocations().map(l => l.name.toLowerCase());
if (isInterLocation) {
  if (!actualToBranch || !known.includes(actualToBranch.toLowerCase()))
    return res.status(400).json({ success: false, error: 'Choose a valid destination branch' });
  if (actualToBranch.toLowerCase() === assignedLocation.toLowerCase())
    return res.status(400).json({ success: false, error: 'Destination must differ from your branch' });
}

// 4) updateStage / markVehicleLeft / recordReturn / addPhoto / incrementPrints:
//    load the entry first; reject with 403 if !canSee(user, entry).

// 5) dashboard: pass the user so stats are scoped
//    DashboardController.getStats:  await db.getStats((req as AuthenticatedRequest).user!)
//    db.getStats(user):             const entries = (await this.getEntries()).filter(e => canSee(user, e));
