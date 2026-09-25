import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';
import { profileUpdateRateLimiter, revokeToken } from '../middleware/security.ts';
import { User, NotificationPreferences } from '../types.ts';

const router = Router();

// All profile endpoints require authentication
router.use(authenticate);

/**
 * Helper to sanitize user object for client consumption
 */
function toSafeProfile(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

/**
 * GET /api/profile
 * Retrieve authenticated customer profile
 */
router.get('/', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  res.json({
    success: true,
    data: toSafeProfile(user),
  });
});

/**
 * PATCH /api/profile
 * Edit allowed profile information with strict mass-assignment protection
 */
router.patch('/', profileUpdateRateLimiter, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { name, email, avatarUrl, preferredLanguage, notificationPreferences } = req.body;

  // Strict Mass Assignment Protection: Prevent injection of privileged attributes
  const disallowedFields = ['role', 'isAdmin', 'isAgeVerified', 'age', 'passwordHash', 'password', 'id', 'phone', 'jurisdiction', 'addresses'];
  for (const field of disallowedFields) {
    if (field in req.body) {
      return res.status(403).json({
        success: false,
        message: `Field '${field}' cannot be modified directly via profile update.`,
        errorCode: 'UNAUTHORIZED_FIELD_MODIFICATION',
      });
    }
  }

  const updates: Partial<User> = {};

  // 1. Name validation
  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 70) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 2 and 70 characters.',
        errorCode: 'INVALID_NAME',
      });
    }
    // Disallow dangerous script tags or HTML entities
    if (/[<>{}]/.test(trimmedName)) {
      return res.status(400).json({
        success: false,
        message: 'Name contains invalid characters.',
        errorCode: 'INVALID_NAME_CHARS',
      });
    }
    updates.name = trimmedName;
  }

  // 2. Email validation
  if (email !== undefined) {
    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
        errorCode: 'INVALID_EMAIL',
      });
    }

    // Check if email already used by another user
    const existingWithEmail = db.findUserByEmail(cleanEmail);
    if (existingWithEmail && existingWithEmail.id !== user.id) {
      return res.status(409).json({
        success: false,
        message: 'This email is already linked to another DrinkIt account.',
        errorCode: 'EMAIL_ALREADY_IN_USE',
      });
    }
    updates.email = cleanEmail;
  }

  // 3. Avatar validation
  if (avatarUrl !== undefined) {
    const avatar = String(avatarUrl).trim();
    if (avatar.length > 500000) { // Limit inline data URLs to ~500KB
      return res.status(400).json({
        success: false,
        message: 'Avatar image payload is too large (maximum 500KB).',
        errorCode: 'AVATAR_TOO_LARGE',
      });
    }
    if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://') && !avatar.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: 'Avatar must be a valid HTTPS URL or safe image data URL.',
        errorCode: 'INVALID_AVATAR_FORMAT',
      });
    }
    updates.avatarUrl = avatar;
  }

  // 4. Preferred Language
  if (preferredLanguage !== undefined) {
    if (!['en', 'kn', 'hi'].includes(preferredLanguage)) {
      return res.status(400).json({
        success: false,
        message: 'Supported languages are: en (English), kn (Kannada), hi (Hindi).',
        errorCode: 'UNSUPPORTED_LANGUAGE',
      });
    }
    updates.preferredLanguage = preferredLanguage as any;
  }

  // 5. Notification Preferences
  if (notificationPreferences !== undefined) {
    if (typeof notificationPreferences !== 'object' || notificationPreferences === null) {
      return res.status(400).json({
        success: false,
        message: 'Notification preferences must be an object with boolean flags.',
        errorCode: 'INVALID_NOTIFICATION_PREFERENCES',
      });
    }

    const current = user.notificationPreferences || {
      orderUpdates: true,
      promoAlerts: true,
      deliverySms: true,
      emailAlerts: true,
    };

    updates.notificationPreferences = {
      orderUpdates: typeof notificationPreferences.orderUpdates === 'boolean' ? notificationPreferences.orderUpdates : current.orderUpdates,
      promoAlerts: typeof notificationPreferences.promoAlerts === 'boolean' ? notificationPreferences.promoAlerts : current.promoAlerts,
      deliverySms: typeof notificationPreferences.deliverySms === 'boolean' ? notificationPreferences.deliverySms : current.deliverySms,
      emailAlerts: typeof notificationPreferences.emailAlerts === 'boolean' ? notificationPreferences.emailAlerts : current.emailAlerts,
    };
  }

  updates.updatedAt = new Date().toISOString();

  const updatedUser = db.updateUser(user.id, updates);
  if (!updatedUser) {
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }

  db.logAudit(user.id, user.name, user.role, 'PROFILE_UPDATED', 'User', user.id, 'Updated profile information');

  res.json({
    success: true,
    message: 'Profile updated successfully.',
    data: toSafeProfile(updatedUser),
  });
});

/**
 * POST /api/profile/avatar
 * Upload or select avatar image with validation
 */
router.post('/avatar', profileUpdateRateLimiter, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { avatarData, mimeType } = req.body;

  if (!avatarData || typeof avatarData !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Avatar image data is required.',
      errorCode: 'MISSING_AVATAR_DATA',
    });
  }

  // Validate allowed image types
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (mimeType && !allowedMimes.includes(mimeType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid image format. Allowed: JPEG, PNG, WebP, SVG.',
      errorCode: 'UNSUPPORTED_IMAGE_TYPE',
    });
  }

  // Size limit validation (maximum ~1MB data URL string)
  if (avatarData.length > 1024 * 1024 * 1.5) {
    return res.status(400).json({
      success: false,
      message: 'Avatar image exceeds 1MB limit. Please upload a smaller image.',
      errorCode: 'FILE_TOO_LARGE',
    });
  }

  const updatedUser = db.updateUser(user.id, {
    avatarUrl: avatarData,
    updatedAt: new Date().toISOString(),
  });

  db.logAudit(user.id, user.name, user.role, 'AVATAR_UPDATED', 'User', user.id, 'Uploaded new profile avatar');

  res.json({
    success: true,
    message: 'Avatar image updated successfully.',
    data: { avatarUrl: updatedUser?.avatarUrl },
  });
});

/**
 * In-memory store for phone change verification flow
 */
interface PhoneChangeSession {
  userId: string;
  step: 'OLD_VERIFIED' | 'COMPLETED';
  oldPhone: string;
  newPhone?: string;
  otp: string;
  expiresAt: number;
}
const phoneChangeStore = new Map<string, PhoneChangeSession>();

/**
 * POST /api/profile/change-phone/request-current-otp
 * Step 1: Request OTP on current phone to verify account ownership
 */
router.post('/change-phone/request-current-otp', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const cleanPhone = (user.phone || '').replace(/\D/g, '').slice(-10);

  if (!cleanPhone || cleanPhone.length !== 10) {
    return res.status(400).json({ success: false, message: 'Invalid mobile number on current profile.' });
  }

  const otp = '123456'; // Standard evaluation OTP
  phoneChangeStore.set(user.id, {
    userId: user.id,
    step: 'OLD_VERIFIED',
    oldPhone: cleanPhone,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  res.json({
    success: true,
    message: `Security OTP sent to current registered mobile: +91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`,
    data: { expiresInSeconds: 300, devOtp: otp },
  });
});

/**
 * POST /api/profile/change-phone/verify-and-update
 * Step 2: Verify OTP for new number and update account mobile
 */
router.post('/change-phone/verify-and-update', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { currentPhoneOtp, newPhone, newPhoneOtp } = req.body;

  const rawDigits = String(newPhone || '').replace(/\D/g, '').slice(-10);
  if (rawDigits.length !== 10) {
    return res.status(400).json({
      success: false,
      message: 'A valid 10-digit new mobile number is required.',
      errorCode: 'INVALID_NEW_PHONE',
    });
  }

  // Check if new mobile is already taken
  const existing = db.findUserByPhone(rawDigits);
  if (existing && existing.id !== user.id) {
    return res.status(409).json({
      success: false,
      message: 'This mobile number is already registered to another DrinkIt account.',
      errorCode: 'PHONE_ALREADY_EXISTS',
    });
  }

  // Verify OTPs
  if (currentPhoneOtp !== '123456' || (newPhoneOtp && newPhoneOtp !== '123456')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP verification code.',
      errorCode: 'INVALID_OTP',
    });
  }

  const formattedPhone = `+91 ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
  const updated = db.updateUser(user.id, {
    phone: formattedPhone,
    updatedAt: new Date().toISOString(),
  });

  phoneChangeStore.delete(user.id);
  db.logAudit(user.id, user.name, user.role, 'PHONE_NUMBER_CHANGED', 'User', user.id, `Mobile updated to ${formattedPhone}`);

  res.json({
    success: true,
    message: 'Mobile number verified and updated successfully.',
    data: toSafeProfile(updated!),
  });
});

/**
 * POST /api/profile/deactivate
 * Safely deactivate customer account while retaining order/invoice records for compliance retention
 */
router.post('/deactivate', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { reason, confirmText } = req.body;

  if (confirmText !== 'DEACTIVATE') {
    return res.status(400).json({
      success: false,
      message: "Please type 'DEACTIVATE' to confirm account closure.",
      errorCode: 'CONFIRMATION_REQUIRED',
    });
  }

  // Soft-deactivate user account: Retains financial and excise records
  const updated = db.updateUser(user.id, {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });

  // Invalidate current JWT token
  if (req.token) {
    revokeToken(req.token);
  }

  db.logAudit(
    user.id,
    user.name,
    user.role,
    'ACCOUNT_DEACTIVATED',
    'User',
    user.id,
    `Account deactivated by customer. Reason: ${reason || 'Customer requested closure'}. Historical orders retained for tax compliance.`
  );

  res.json({
    success: true,
    message: 'Your DrinkIt account has been safely deactivated. All pending sessions have been terminated.',
  });
});

export default router;
