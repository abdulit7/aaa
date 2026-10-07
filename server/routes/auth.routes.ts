import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', requireAuth, AuthController.logout);
authRouter.get('/me', requireAuth, AuthController.getCurrentUser);
authRouter.get('/sessions', requireAuth, AuthController.getActiveSessions);
authRouter.post('/password', requireAuth, AuthController.changePassword);
