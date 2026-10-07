import { Request, Response } from 'express';
import { db } from '../db.js';
import { signJWT } from '../auth.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { isMySQLConnected } from '../mysqlClient.js';

export class AuthController {
  public static async login(req: Request, res: Response) {
    const { login, password, device, device_type } = req.body;
    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const user = db.findUserByLogin(login);
    if (!user || !user.active) {
      return res.status(401).json({ success: false, error: 'Invalid username or account disabled' });
    }

    if (user.failed >= 10) {
      return res.status(403).json({ success: false, error: 'Account locked due to 10 consecutive failed attempts. Contact system administrator.' });
    }

    const isValid = db.verifyPassword(user, password);
    if (!isValid) {
      db.recordFailedLogin(user.id);
      db.addAudit(user.id, user.name, 'LOGIN_FAILED', null, { ip: req.ip });
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    db.resetFailedLogin(user.id);

    const effectiveDeviceType: 'tablet' | 'web' = (device_type === 'tablet' || device_type === 'web')
      ? device_type
      : (user.device_type === 'tablet' ? 'tablet' : 'web');

    const { sessionId, refreshToken } = db.createSession(
      user.id,
      user.login,
      device || (effectiveDeviceType === 'tablet' ? 'Tablet Kiosk' : 'Web Terminal'),
      req.ip,
      effectiveDeviceType,
      user.gate || 'Main Gate',
      user.location || 'Estate 1'
    );

    const token = signJWT({
      userId: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      gate: user.gate,
      location: user.location || 'Estate 1',
      device_type: effectiveDeviceType,
      sessionId
    }, 12 * 60 * 60);

    db.addAudit(user.id, user.name, 'LOGIN_SUCCESS', null, {
      gate: user.gate,
      location: user.location || 'Estate 1',
      device_type: effectiveDeviceType,
      device: device || (effectiveDeviceType === 'tablet' ? 'Tablet Terminal' : 'Web Console'),
      ip: req.ip
    });

    res.json({
      success: true,
      token,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        gate: user.gate,
        location: user.location || 'Estate 1',
        device_type: effectiveDeviceType,
        must_change: user.must_change
      }
    });
  }

  public static async refresh(req: Request, res: Response) {
    const { sessionId, refreshToken } = req.body;
    if (!sessionId || !refreshToken) {
      return res.status(400).json({ success: false, error: 'sessionId and refreshToken required' });
    }

    const newRefresh = db.rotateRefreshToken(sessionId, refreshToken);
    if (!newRefresh) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid refresh token' });
    }

    const session = db.validateSession(sessionId);
    if (!session) return res.status(401).json({ success: false, error: 'Session revoked or invalid' });
    const user = db.findUserById(session.userId);
    if (!user || !user.active) return res.status(401).json({ success: false, error: 'User account inactive' });

    const effectiveDeviceType = session.device_type || user.device_type || 'web';

    const newToken = signJWT({
      userId: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      gate: user.gate,
      location: user.location || 'Estate 1',
      device_type: effectiveDeviceType,
      sessionId
    }, 12 * 60 * 60);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefresh,
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        gate: user.gate,
        location: user.location || 'Estate 1',
        device_type: effectiveDeviceType,
        must_change: user.must_change
      }
    });
  }

  public static async logout(req: AuthenticatedRequest, res: Response) {
    if (req.session) {
      db.revokeSession(req.session.sessionId);
    }
    if (req.user) {
      db.addAudit(req.user.id, req.user.name, 'LOGOUT', null, { sessionId: req.session?.sessionId });
    }
    res.json({ success: true, message: 'Logged out successfully from this device' });
  }

  public static async getCurrentUser(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const effectiveDeviceType = req.session?.device_type || req.user.device_type || 'web';
    res.json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        login: req.user.login,
        role: req.user.role,
        gate: req.user.gate,
        location: req.user.location || 'Estate 1',
        device_type: effectiveDeviceType,
        must_change: req.user.must_change
      },
      sessionId: req.session?.sessionId
    });
  }

  public static async getActiveSessions(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const sessions = db.getActiveSessionsForUser(req.user.id);
    res.json(sessions);
  }

  public static async changePassword(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
    }

    if (!db.verifyPassword(req.user, oldPassword)) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    await db.updateUserPassword(req.user.id, newPassword);
    db.addAudit(req.user.id, req.user.name, 'PASSWORD_CHANGED', null, {});
    res.json({ success: true, message: 'Password updated successfully' });
  }
}
