// In entries.routes.ts: replace the three inter-branch lines with these and add
//   import { TransferController } from '../controllers/transfers.controller.js';
// URLs stay the same, so the React client keeps working.

entriesRouter.post('/:code/acknowledge-receipt', requireMySQL, TransferController.receive);
entriesRouter.post('/:code/dispatch-return',     requireMySQL, TransferController.sendBack);
entriesRouter.post('/:code/receive-return',      requireMySQL, TransferController.receiveBack);

// requireAuth is now applied once in routes/index.ts, so the per-route copies are optional.
// '/next-code' and '/:code/print' are also behind it now.
