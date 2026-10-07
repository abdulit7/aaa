import { Router } from 'express';
import { UsersController } from '../controllers/users.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { requireMySQL } from '../middleware/mysql.middleware.js';

export const usersRouter = Router();

usersRouter.get('/locations', UsersController.getLocations);
usersRouter.post('/locations', requireAuth, requireRole(['admin']), UsersController.createLocation);
usersRouter.put('/locations/:oldName', requireAuth, requireRole(['admin']), UsersController.updateLocation);
usersRouter.delete('/locations/:name', requireAuth, requireRole(['admin']), UsersController.deleteLocation);
usersRouter.get('/grouped', requireAuth, requireRole(['admin', 'supervisor']), UsersController.listGrouped);

usersRouter.get('/', requireAuth, requireRole(['admin', 'supervisor']), UsersController.list);
usersRouter.post('/', requireAuth, requireRole(['admin']), UsersController.create);
usersRouter.put('/:id', requireAuth, requireRole(['admin']), UsersController.update);
usersRouter.delete('/:id', requireAuth, requireRole(['admin']), UsersController.delete);
