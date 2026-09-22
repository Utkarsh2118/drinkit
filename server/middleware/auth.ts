import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/database.ts';
import { User, UserRole } from '../types.ts';

// Portable base64url JWT implementation (HS256) with no external jwt library dependency.
const JWT_SECRET = process.env.JWT_SECRET || 'drinkit_super_secret_jwt_key_2026';

if (!process.env.JWT_SECRET) {
  // Loud dev-only warning so a real secret doesn't get forgotten before deploying.
  console.warn('[auth] JWT_SECRET is not set in the environment — using an insecure default. Set JWT_SECRET before deploying.');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
}

export function signToken(payload: { id: string; email: string; role: UserRole }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 })).toString('base64url');
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { id: string; email: string; role: UserRole } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSig = sign(`${header}.${body}`);
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSig);
    // Constant-time comparison so signature checking can't leak timing info.
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export interface AuthRequest extends Request {
  user?: User;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.', errorCode: 'UNAUTHORIZED' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token. Please log in again.', errorCode: 'INVALID_TOKEN' });
  }

  const user = db.findUserById(payload.id);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User account not found.', errorCode: 'USER_NOT_FOUND' });
  }

  req.user = user;
  next();
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      const user = db.findUserById(payload.id);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required', errorCode: 'UNAUTHORIZED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. You need one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        errorCode: 'FORBIDDEN',
      });
    }

    next();
  };
}