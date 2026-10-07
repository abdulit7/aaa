import { Router } from 'express';
import { EntriesController } from '../controllers/entries.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMySQL } from '../middleware/mysql.middleware.js';

export const entriesRouter = Router();

// Next code sequence generator
entriesRouter.get('/next-code', EntriesController.getNextCode);

// List entries with filtering, pagination, search
entriesRouter.get('/', requireMySQL, EntriesController.list);

// Single entry details
entriesRouter.get('/:code', requireMySQL, EntriesController.getByCode);

// Create entry
entriesRouter.post('/', requireMySQL, requireAuth, EntriesController.create);

// Stage transition (Kanban / Checkpoint)
entriesRouter.put('/:code/stage', requireMySQL, requireAuth, EntriesController.updateStage);
entriesRouter.patch('/:code/stage', requireMySQL, requireAuth, EntriesController.updateStage);

// Mark vehicle departure
entriesRouter.post('/:code/vehicle-left', requireMySQL, requireAuth, EntriesController.markVehicleLeft);
entriesRouter.post('/:code/exit', requireMySQL, requireAuth, EntriesController.markVehicleLeft);

// Mark return of returnable item
entriesRouter.post('/:code/return', requireMySQL, requireAuth, EntriesController.recordReturn);

// Inter-Branch Transfer workflow
entriesRouter.post('/:code/acknowledge-receipt', requireMySQL, requireAuth, EntriesController.acknowledgeInterBranchReceipt);
entriesRouter.post('/:code/dispatch-return', requireMySQL, requireAuth, EntriesController.dispatchInterBranchReturn);
entriesRouter.post('/:code/receive-return', requireMySQL, requireAuth, EntriesController.receiveInterBranchReturn);

// Increment print / reprint audit count
entriesRouter.post('/:code/print', EntriesController.incrementPrints);

// Attach photo to existing entry
entriesRouter.post('/:code/photos', requireMySQL, requireAuth, EntriesController.addPhoto);

// Supervisor official corrections
entriesRouter.put('/:code/correct', requireMySQL, requireAuth, EntriesController.addCorrection);

// Cancel entry
entriesRouter.post('/:code/cancel', requireMySQL, requireAuth, EntriesController.cancel);
