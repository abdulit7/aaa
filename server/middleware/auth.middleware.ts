import { Request, Response, NextFunction } from 'express';
import { db, AppUser, UserSession } from '../db.js';
import { verifyJWT, JWTPayload } from '../auth.js';

export interface AuthenticatedRequest extends Request {
  user?: AppUser;
  session?: UserSession;
  jwt?: JWTPayload;
}

export function extractAuthContext(req: AuthenticatedRequest): { user?: AppUser; session?: UserSession; jwt?: JWTPayload } {
  const authHeader = req.headers.authorization;
  if (!authHeader) return {};
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return {};

  const jwtPayload = verifyJWT(token);
  if (jwtPayload) {
    const session = db.validateSession(jwtPayload.sessionId);
    if (!session) return {};
    const user = db.findUserById(jwtPayload.userId);
    if (!user || !user.active) return {};
    return { user, session, jwt: jwtPayload };
  }

  // Fallback for legacy user ID token
  const legacyUser = db.findUserById(token);
  if (legacyUser && legacyUser.active) {
    return { user: legacyUser };
  }

  return {};
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const ctx = extractAuthContext(req);
  if (!ctx.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Authentication token is invalid or expired.' });
  }
  req.user = ctx.user;
  req.session = ctx.session;
  req.jwt = ctx.jwt;
  next();
}

export function requireRole(allowedRoles: Array<'guard' | 'supervisor' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      const ctx = extractAuthContext(req);
      if (!ctx.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }
      req.user = ctx.user;
      req.session = ctx.session;
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. This action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`
      });
    }

    next();
  };
}
