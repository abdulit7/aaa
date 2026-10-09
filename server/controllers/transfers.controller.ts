import { Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { canSee, isDestination, isOrigin } from '../utils/scope.js';

/*
 * Inter-branch flow
 *   Sender creates OUT pass             -> IN_TRANSIT        (destination notified when created)
 *   Destination: receive                -> RECEIVED/COMPLETED, or PENDING_RETURN if returnable
 *   Destination: send back (returnable) -> RETURN_IN_TRANSIT (sender notified)
 *   Sender: receive back                -> COMPLETED         (destination notified)
 *
 * Each step checks: who you are, which branch you belong to, and the current status.
 * VERIFY the status strings below match what db.ts writes to inter_branch_details.status.
 */

const statusOf = (e: any) => String(e.inter_branch_details?.status || '').toUpperCase();

async function loadEntry(req: AuthenticatedRequest, res: Response) {
  const entry = await db.getEntryByCode(req.params.code);
  if (!entry) { res.status(404).json({ success: false, error: 'Entry not found' }); return null; }
  if (!canSee(req.user!, entry)) { res.status(403).json({ success: false, error: 'Not allowed for your location' }); return null; }
  return entry;
}

function notify(entry: any, from: string, to: string, type: string, title: string, message: string) {
  db.addNotification({
    target_location: to,
    from_location: from,
    code: entry.code,
    type: type as any,        // add these values to AppNotification['type']
    title,
    message,
    metadata: { pass_no: entry.code }
  } as any);
}

export class TransferController {
  // Destination branch marks the material as received
  static async receive(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const entry = await loadEntry(req, res); if (!entry) return;
      if (!isDestination(user, entry))
        return res.status(403).json({ success: false, error: 'Only the destination branch can receive this material' });
      if (statusOf(entry) !== 'IN_TRANSIT')
        return res.status(409).json({ success: false, error: `Cannot receive: status is ${statusOf(entry) || 'unknown'}` });

      const { received_items, remarks, guard_name } = req.body;
      const updated = await db.acknowledgeInterBranchReceipt(entry.code, {
        guard_id: user.id,
        guard_name: (guard_name && String(guard_name).trim()) || user.name,
        receiving_branch: user.location,      // never taken from the request body
        receiving_gate: user.gate,
        received_items,
        remarks
      } as any);

      notify(entry, user.location || '', entry.from_branch || entry.location, 'received',
        'Material Received', `${entry.code} was received at ${user.location} by ${user.name}.`);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Receive failed' });
    }
  }

  // Destination branch sends returnable material back
  static async sendBack(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const entry = await loadEntry(req, res); if (!entry) return;
      if (!isDestination(user, entry))
        return res.status(403).json({ success: false, error: 'Only the destination branch can send this back' });
      if (!entry.returnable)
        return res.status(400).json({ success: false, error: 'This material is not returnable' });
      if (statusOf(entry) !== 'PENDING_RETURN')
        return res.status(409).json({ success: false, error: `Cannot send back: status is ${statusOf(entry) || 'unknown'}` });

      await db.dispatchInterBranchReturn(entry.code, req.body, user as any);
      const fresh = await db.getEntryByCode(entry.code);   // page expects the entry, not the gate-pass record

      notify(entry, user.location || '', entry.from_branch || entry.location, 'return_dispatched',
        'Material Sent Back', `${entry.code} is being returned from ${user.location}. Vehicle: ${req.body.vehicle_no || '-'}.`);
      res.json(fresh);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Send back failed' });
    }
  }

  // Sending branch confirms the returned material arrived back
  static async receiveBack(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user!;
      const entry = await loadEntry(req, res); if (!entry) return;
      if (!isOrigin(user, entry))
        return res.status(403).json({ success: false, error: 'Only the sending branch can receive this back' });
      if (statusOf(entry) !== 'RETURN_IN_TRANSIT')
        return res.status(409).json({ success: false, error: `Cannot receive back: status is ${statusOf(entry) || 'unknown'}` });

      await db.receiveInterBranchReturn(entry.code, req.body, user as any);
      const fresh = await db.getEntryByCode(entry.code);

      notify(entry, user.location || '', entry.to_branch || '', 'return_received',
        'Return Confirmed', `${entry.code} was received back at ${user.location}. Transfer completed.`);
      res.json(fresh);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Receive back failed' });
    }
  }
}
