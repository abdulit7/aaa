import { Request, Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class EntriesController {
  public static async list(req: Request, res: Response) {
    try {
      const { q, dir, stage, from, to, returnable, insideOnly, cancelled, limit, gate, location, movement_type } = req.query;
      let entries = await db.getEntries();

      if (dir && (dir === 'IN' || dir === 'OUT')) {
        entries = entries.filter(e => e.dir === dir);
      }

      if (movement_type && String(movement_type) !== 'ALL') {
        entries = entries.filter(e => e.movement_type === String(movement_type));
      }

      if (gate && String(gate) !== 'ALL') {
        entries = entries.filter(e => e.gate === String(gate));
      }

      if (location && String(location) !== 'ALL') {
        entries = entries.filter(e => e.location === String(location));
      }

      if (stage) {
        entries = entries.filter(e => e.stage === stage);
      }

      if (from) {
        entries = entries.filter(e => e.at.slice(0, 10) >= String(from));
      }

      if (to) {
        entries = entries.filter(e => e.at.slice(0, 10) <= String(to));
      }

      if (returnable === 'true') {
        entries = entries.filter(e => e.returnable);
      }

      if (insideOnly === 'true') {
        entries = entries.filter(e => e.dir === 'IN' && !e.vehicle_out_at && e.vehicle_type !== 'Hand carried');
      }

      if (cancelled !== 'true') {
        entries = entries.filter(e => !e.cancelled);
      }

      if (q) {
        const query = String(q).toLowerCase();
        entries = entries.filter(e => {
          return (
            e.code.toLowerCase().includes(query) ||
            e.party.toLowerCase().includes(query) ||
            (e.purchaser_name && e.purchaser_name.toLowerCase().includes(query)) ||
            (e.person && e.person.toLowerCase().includes(query)) ||
            e.vehicle_no.toLowerCase().includes(query) ||
            (e.doc_no && e.doc_no.toLowerCase().includes(query)) ||
            (e.driver && e.driver.toLowerCase().includes(query)) ||
            (e.po_no && e.po_no.toLowerCase().includes(query)) ||
            (e.from_branch && e.from_branch.toLowerCase().includes(query)) ||
            (e.to_branch && e.to_branch.toLowerCase().includes(query)) ||
            (e.movement_type && e.movement_type.toLowerCase().includes(query)) ||
            e.items.some(i => i.desc.toLowerCase().includes(query))
          );
        });
      }

      if (limit) {
        const numLimit = parseInt(String(limit), 10);
        if (!isNaN(numLimit) && numLimit > 0) {
          entries = entries.slice(0, numLimit);
        }
      }

      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list entries' });
    }
  }

  public static getNextCode(_req: Request, res: Response) {
    const code = db.peekNextCode();
    res.json({ code });
  }

  public static async getByCode(req: Request, res: Response) {
    try {
      const code = req.params.code;
      const entry = await db.getEntryByCode(code);
      if (!entry) {
        return res.status(404).json({ success: false, error: 'Entry not found' });
      }
      const photos = db.getPhotosForEntry(entry.id);
      const audit = db.getAuditLogs(code);
      res.json({ entry, photos, audit });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to retrieve entry' });
    }
  }

  public static async create(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    try {
      const {
        code,
        dir,
        gate,
        guard_name,
        purpose,
        party,
        vehicle_type,
        vehicle_no,
        driver,
        driver_id,
        doc_type,
        doc_no,
        amount,
        po_no,
        authorised_by,
        dept,
        items,
        weight,
        packages,
        person,
        remarks,
        returnable,
        expected_return,
        against,
        photos,
        inward_type,
        purchaser_name,
        personal_purpose,
        movement_type,
        from_branch,
        to_branch,
        inter_branch_details
      } = req.body;

      if (!dir || (dir !== 'IN' && dir !== 'OUT')) {
        return res.status(400).json({ success: false, error: 'Valid direction (IN or OUT) is required' });
      }
      if (!party || !party.trim()) {
        return res.status(400).json({ success: false, error: 'Party/Supplier/Purchaser name is required' });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one material item must be recorded' });
      }

      const cleanedItems = items.map((itm: any, idx: number) => ({
        id: `itm-${Date.now()}-${idx}`,
        desc: String(itm.desc || '').trim(),
        qty: Number(itm.qty) || 0,
        unit: String(itm.unit || 'Bags').trim()
      })).filter(i => i.desc && i.qty > 0);

      if (cleanedItems.length === 0) {
        return res.status(400).json({ success: false, error: 'Each material item must have a non-empty description and positive quantity' });
      }

      const assignedGate = (gate && String(gate).trim()) || user.gate || 'Main Gate';
      const assignedLocation = (req.body.location && String(req.body.location).trim()) || user.location || 'Estate 1';
      const assignedDeviceType = req.body.device_type || user.device_type || 'web';

      const isInterLocation = movement_type === 'Inter-Location Transfer' || movement_type === 'Inter-Branch Transfer';
      const actualFromBranch = from_branch || (isInterLocation ? assignedLocation : undefined);
      const actualToBranch = to_branch || (isInterLocation ? party.trim() : undefined);

      const interBranchData = (isInterLocation || inter_branch_details)
        ? (inter_branch_details || {
            from_branch: actualFromBranch,
            to_branch: actualToBranch,
            status: 'in_transit',
            dispatched_at: new Date().toISOString(),
            dispatched_guard: (guard_name && String(guard_name).trim()) || user.name,
            items_tracking: cleanedItems.map(i => ({
              item_id: i.id,
              desc: i.desc,
              sent_qty: i.qty,
              received_qty: 0,
              returned_qty: 0,
              unit: i.unit
            }))
          })
        : null;

      const created = await db.createEntry({
        code: code ? String(code).trim().toUpperCase() : undefined,
        dir,
        movement_type: isInterLocation ? 'Inter-Location Transfer' : (movement_type || 'External / Supplier'),
        from_branch: actualFromBranch,
        to_branch: actualToBranch,
        inter_branch_details: interBranchData,
        inward_type: inward_type || (vehicle_type === 'Hand carried' ? 'purchaser_hand' : 'vehicle'),
        purchaser_name: purchaser_name ? String(purchaser_name).trim() : undefined,
        personal_purpose: personal_purpose ? String(personal_purpose).trim() : undefined,
        gate: assignedGate,
        location: assignedLocation,
        device_type: assignedDeviceType,
        guard_id: user.id,
        guard_name: (guard_name && String(guard_name).trim()) || user.name,
        purpose: purpose || 'Purchase',
        party: party.trim(),
        vehicle_type: vehicle_type || 'Truck',
        vehicle_no: (vehicle_no || '').toUpperCase().trim(),
        driver: driver || '',
        driver_id: driver_id || '',
        doc_type: doc_type || 'Delivery Challan',
        doc_no: doc_no || '',
        amount: amount !== undefined && amount !== '' ? Number(amount) : null,
        po_no: po_no || '',
        authorised_by: authorised_by || '',
        dept: dept || '',
        items: cleanedItems,
        weight: weight !== undefined && weight !== '' ? Number(weight) : null,
        packages: packages !== undefined && packages !== '' ? Number(packages) : null,
        person: person || '',
        remarks: remarks || '',
        returnable: Boolean(returnable),
        expected_return: returnable && expected_return ? expected_return : null,
        returned_at: null,
        return_code: null,
        against: against || null,
        vehicle_out_at: dir === 'OUT' ? new Date().toISOString() : null,
        stage: dir === 'OUT' ? 'cleared' : 'at_gate'
      });

      if (isInterLocation && actualToBranch && actualFromBranch) {
        const itemsSummary = cleanedItems.map(i => `${i.desc} (${i.qty} ${i.unit})`).join(', ');
        db.addNotification({
          target_location: actualToBranch,
          from_location: actualFromBranch,
          code: created.code,
          type: 'new_incoming',
          title: '🔔 New Incoming Material',
          message: `Gate Pass ${created.code} has been created from ${actualFromBranch} to ${actualToBranch}. Material: ${itemsSummary}. Returnable: ${returnable ? 'YES' : 'NO'}. Vehicle: ${vehicle_no || 'NO VEHICLE'}, Driver: ${driver || 'Staff'}. Status: Awaiting Dispatch.`,
          metadata: {
            pass_no: created.code,
            from_branch: actualFromBranch,
            to_branch: actualToBranch,
            returnable: Boolean(returnable),
            vehicle: vehicle_no,
            driver,
            materials: itemsSummary
          }
        });
      }

      // Save photos directly to MySQL if present
      if (photos && Array.isArray(photos)) {
        for (const p of photos) {
          const url = p.data_url || p.dataUrl;
          if (url) {
            await db.addPhoto({
              entry_id: created.id,
              data_url: url,
              note: p.note || 'Invoice / Material photo',
              mime: p.mime || 'image/jpeg',
              captured_by: user.id
            });
          }
        }
      }

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to save entry' });
    }
  }

  public static async updateStage(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { stage } = req.body;
    const allowedStages = ['at_gate', 'dock_weighbridge', 'inspection_unloading', 'cleared'];
    if (!allowedStages.includes(stage)) {
      return res.status(400).json({ success: false, error: 'Invalid checkpoint stage' });
    }

    try {
      const updated = await db.updateEntryStage(req.params.code, stage, user.id, user.name);
      res.json(updated);
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Entry not found' });
    }
  }

  public static async markVehicleLeft(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    try {
      const updated = await db.markVehicleLeft(req.params.code, user.id, user.name);
      res.json(updated);
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message || 'Entry not found' });
    }
  }

  public static async recordReturn(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    try {
      const {
        guard_name,
        vehicle_type,
        vehicle_no,
        driver,
        driver_id,
        doc_type,
        doc_no,
        returned_items,
        remarks,
        photos
      } = req.body;

      const updated = await db.recordReturn(req.params.code, {
        guard_id: user.id,
        guard_name: (guard_name && String(guard_name).trim()) || user.name,
        vehicle_type,
        vehicle_no,
        driver,
        driver_id,
        doc_type,
        doc_no,
        returned_items,
        remarks,
        photos
      });

      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to record return' });
    }
  }

  public static async acknowledgeInterBranchReceipt(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    try {
      const { receiving_branch, receiving_gate, guard_name, received_items, remarks } = req.body;
      const updated = await db.acknowledgeInterBranchReceipt(req.params.code, {
        guard_id: user.id,
        guard_name: (guard_name && String(guard_name).trim()) || user.name,
        receiving_branch: receiving_branch || user.location,
        receiving_gate: receiving_gate || user.gate,
        received_items,
        remarks
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to acknowledge inter-branch receipt' });
    }
  }

  public static async dispatchInterBranchReturn(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    try {
      const updated = await db.dispatchInterBranchReturn(req.params.code, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to dispatch inter-branch return' });
    }
  }

  public static async receiveInterBranchReturn(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    try {
      const updated = await db.receiveInterBranchReturn(req.params.code, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to receive returned inter-branch material' });
    }
  }

  public static async incrementPrints(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    const userId = user ? user.id : 'anon';
    const userName = user ? user.name : 'Terminal Guard';

    const { format } = req.body;
    try {
      const updated = await db.incrementPrints(req.params.code, userId, userName, format || 'slip');
      res.json(updated);
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  public static async addPhoto(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const entry = await db.getEntryByCode(req.params.code);
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });

    const { data_url, dataUrl, note, mime } = req.body;
    const url = data_url || dataUrl;
    if (!url) return res.status(400).json({ success: false, error: 'Photo data required' });

    const photo = await db.addPhoto({
      entry_id: entry.id,
      data_url: url,
      note: note || 'Additional photo',
      mime: mime || 'image/jpeg',
      captured_by: user.id
    });

    db.addAudit(user.id, user.name, 'PHOTO_ATTACHED', entry.code, { note: photo.note });
    res.status(201).json(photo);
  }

  public static async addCorrection(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (user.role !== 'supervisor' && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only Supervisors and Admins can log corrections' });
    }

    const { field, newValue, reason } = req.body;
    if (!field || newValue === undefined || !reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Field, newValue, and detailed reason are required' });
    }

    try {
      const updated = await db.addCorrection(req.params.code, field, String(newValue), reason, user.id, user.name);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async cancel(req: AuthenticatedRequest, res: Response) {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (user.role !== 'supervisor' && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only Supervisors and Admins can cancel entries' });
    }

    const { reason } = req.body;
    if (!reason || reason.trim().length < 4) {
      return res.status(400).json({ success: false, error: 'A valid detailed reason is required for cancellation' });
    }

    try {
      const updated = await db.cancelEntry(req.params.code, reason, user.id, user.name);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}
