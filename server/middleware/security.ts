import { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.ts';

// In-memory token revocation blacklist (persisted to DB store as well)
const revokedTokensMemory = new Set<string>();

export function revokeToken(token: string) {
  if (!token) return;
  revokedTokensMemory.add(token);
  db.revokeToken(token);
}

export function isTokenRevoked(token: string): boolean {
  if (!token) return true;
  if (revokedTokensMemory.has(token)) return true;
  return db.isTokenRevoked(token);
}

/**
 * Robust Security Headers Middleware
 * Protects against MIME sniffing, clickjacking, XSS, and unapproved embedding.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking in normal views while allowing applet iframe embed
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // XSS protection legacy header
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissive yet safe Content-Security-Policy that works with Vite HMR, Google Maps, Razorpay, and CDNs
  const cspDirectives = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://maps.googleapis.com https://*.google.com https://*.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.gstatic.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://images.unsplash.com https://maps.googleapis.com https://*.google.com https://*.gstatic.com https://*.openstreetmap.org",
    "connect-src 'self' ws: wss: https: http://localhost:* https://*.googleapis.com https://api.razorpay.com https://nominatim.openstreetmap.org",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // Disable cache for sensitive API responses
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/profile')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * NoSQL Injection & Prototype Pollution Sanitizer
 * Recursively inspects request query, body, and params to reject or strip
 * dangerous operator keys ($where, $gt, $ne, __proto__, constructor).
 */
export function noSqlSanitizer(req: Request, res: Response, next: NextFunction) {
  const sanitize = (obj: any): { clean: any; hasDisallowed: boolean } => {
    if (!obj || typeof obj !== 'object') {
      return { clean: obj, hasDisallowed: false };
    }

    if (Array.isArray(obj)) {
      let disallowed = false;
      const cleanArr = obj.map(item => {
        const res = sanitize(item);
        if (res.hasDisallowed) disallowed = true;
        return res.clean;
      });
      return { clean: cleanArr, hasDisallowed: disallowed };
    }

    let disallowed = false;
    const cleanObj: Record<string, any> = {};

    for (const key of Object.keys(obj)) {
      // Disallow MongoDB query operator keys or prototype pollution keys
      if (
        key.startsWith('$') ||
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype'
      ) {
        disallowed = true;
        continue; // Strip key
      }

      const res = sanitize(obj[key]);
      if (res.hasDisallowed) disallowed = true;
      cleanObj[key] = res.clean;
    }

    return { clean: cleanObj, hasDisallowed: disallowed };
  };

  if (req.body && typeof req.body === 'object') {
    const { clean, hasDisallowed } = sanitize(req.body);
    if (hasDisallowed) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request payload: prohibited query operators or prototype keys detected.',
        errorCode: 'INVALID_INPUT_OPERATOR',
      });
    }
    req.body = clean;
  }

  if (req.query && typeof req.query === 'object') {
    const { clean, hasDisallowed } = sanitize(req.query);
    if (hasDisallowed) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters: prohibited operators detected.',
        errorCode: 'INVALID_QUERY_OPERATOR',
      });
    }
    req.query = clean;
  }

  next();
}

/**
 * In-Memory Sliding-Window Rate Limiter
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function createRateLimiter(options: {
  windowMs: number; // e.g., 60 * 1000 for 1 minute
  maxRequests: number; // e.g., 5
  message: string;
  errorCode?: string;
  keyGenerator?: (req: Request) => string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate key: either custom generator or IP + endpoint
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = options.keyGenerator ? options.keyGenerator(req) : `${ip}_${req.baseUrl}${req.path}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        success: false,
        message: `${options.message} Please retry in ${retryAfterSec} seconds.`,
        errorCode: options.errorCode || 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: retryAfterSec,
      });
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    next();
  };
}

// 1. Strict rate limiter for customer OTP requests: 5 per 10 minutes per phone/IP
export const otpSendRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many OTP requests. Please try again later.',
  errorCode: 'OTP_SEND_RATE_LIMITED',
  keyGenerator: req => {
    const rawDigits = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
    const ip = req.ip || 'ip';
    return `otp_send_${rawDigits || ip}`;
  },
});

// 2. Strict rate limiter for OTP verification attempts: 10 per 5 minutes per phone
export const otpVerifyRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many attempts. Please request a new OTP.',
  errorCode: 'OTP_VERIFY_RATE_LIMITED',
  keyGenerator: req => {
    const rawDigits = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
    const ip = req.ip || 'ip';
    return `otp_verify_${rawDigits || ip}`;
  },
});

// 3. Strict rate limiter for Admin / Portal password logins: 8 per 15 minutes per identifier
export const portalLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  message: 'Too many login attempts. Account temporarily locked for security.',
  errorCode: 'LOGIN_RATE_LIMITED',
  keyGenerator: req => {
    const id = String(req.body?.adminId || req.body?.staffId || req.body?.agentId || req.body?.email || req.ip || 'user').trim().toLowerCase();
    return `portal_login_${id}`;
  },
});

// 4. Rate limiter for Profile update writes: 20 per minute per IP
export const profileUpdateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Too many profile update requests.',
  errorCode: 'PROFILE_UPDATE_RATE_LIMITED',
});

// 5. Rate limiter for support tickets creation: 10 per 10 minutes
export const supportTicketRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many support tickets submitted recently. Please wait before creating another.',
  errorCode: 'SUPPORT_TICKET_RATE_LIMITED',
});
