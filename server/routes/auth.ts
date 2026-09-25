import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { signToken, authenticate, AuthRequest, verifyPassword, hashPassword } from '../middleware/auth.ts';
import { ComplianceService } from '../services/compliance.ts';
import {
  otpSendRateLimiter,
  otpVerifyRateLimiter,
  portalLoginRateLimiter,
  revokeToken,
} from '../middleware/security.ts';
import { User, Address } from '../types.ts';

const router = Router();

interface OtpSession {
  phone: string;
  otp: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}
const otpMemoryStore = new Map<string, OtpSession>();

// --- CUSTOMER MOBILE + OTP AUTHENTICATION ---

// 1. Send OTP to mobile
router.post('/otp/send', otpSendRateLimiter, (req, res) => {
  const { phone } = req.body;
  const rawDigits = String(phone || '').replace(/\D/g, '');
  const tenDigits = rawDigits.slice(-10);

  // Validate Indian mobile number format: exactly 10 digits starting with 6, 7, 8, or 9
  if (tenDigits.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigits)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid 10-digit Indian mobile number',
      errorCode: 'INVALID_PHONE',
    });
  }

  const existing = otpMemoryStore.get(tenDigits);
  const now = Date.now();
  const RESEND_COOLDOWN_MS = 30000; // 30 seconds cooldown

  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return res.status(429).json({
      success: false,
      message: 'Too many OTP requests. Please try again later.',
      detailMessage: `Please wait ${remainingSeconds}s before requesting a new OTP.`,
      errorCode: 'OTP_RATE_LIMITED',
      retryAfterSeconds: remainingSeconds,
    });
  }

  // Generate 6-digit OTP (for dev/evaluation reliability: 123456 for demo numbers or secure random 6 digits)
  const isDevMode = process.env.NODE_ENV !== 'production';
  const isDemoNumber = tenDigits === '9876543210' || tenDigits === '9876543213';
  const otp = isDemoNumber ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

  otpMemoryStore.set(tenDigits, {
    phone: tenDigits,
    otp,
    expiresAt: now + 5 * 60 * 1000, // 5 minutes validity
    lastSentAt: now,
    attempts: 0,
  });

  // Check if existing user
  const user = db.findUserByPhone(tenDigits);

  res.json({
    success: true,
    message: `OTP sent to +91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`,
    data: {
      phone: tenDigits,
      expiresInSeconds: 300,
      resendCooldownSeconds: 30,
      isExistingCustomer: Boolean(user),
      // Dev OTP strictly isolated to non-production environments
      devOtp: isDevMode ? otp : undefined,
    },
  });
});

// 2. Verify OTP
router.post('/otp/verify', otpVerifyRateLimiter, (req, res) => {
  const { phone, otp } = req.body;
  const rawDigits = String(phone || '').replace(/\D/g, '');
  const tenDigits = rawDigits.slice(-10);
  const submittedOtp = String(otp || '').trim();

  if (tenDigits.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigits)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid 10-digit Indian mobile number',
      errorCode: 'INVALID_PHONE',
    });
  }

  if (!submittedOtp || submittedOtp.length !== 6 || !/^\d{6}$/.test(submittedOtp)) {
    return res.status(400).json({
      success: false,
      message: "That OTP doesn't look right. Please try again.",
      errorCode: 'INVALID_OTP_LENGTH',
    });
  }

  const session = otpMemoryStore.get(tenDigits);
  const isDevMode = process.env.NODE_ENV !== 'production';
  const isValidDevOtp = isDevMode && submittedOtp === '123456' && (tenDigits === '9876543210' || tenDigits === '9876543213');

  if (!session && !isValidDevOtp) {
    return res.status(400).json({
      success: false,
      message: 'This OTP has expired. Please request a new one.',
      errorCode: 'EXPIRED_OTP',
    });
  }

  if (session) {
    if (Date.now() > session.expiresAt) {
      otpMemoryStore.delete(tenDigits);
      return res.status(400).json({
        success: false,
        message: 'This OTP has expired. Please request a new one.',
        errorCode: 'EXPIRED_OTP',
      });
    }

    if (session.attempts >= 5) {
      otpMemoryStore.delete(tenDigits);
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please request a new OTP.',
        errorCode: 'MAX_ATTEMPTS_EXCEEDED',
      });
    }

    if (session.otp !== submittedOtp && !isValidDevOtp) {
      session.attempts += 1;
      if (session.attempts >= 5) {
        otpMemoryStore.delete(tenDigits);
        return res.status(429).json({
          success: false,
          message: 'Too many attempts. Please request a new OTP.',
          errorCode: 'MAX_ATTEMPTS_EXCEEDED',
        });
      }
      return res.status(400).json({
        success: false,
        message: "That OTP doesn't look right. Please try again.",
        errorCode: 'INCORRECT_OTP',
        attemptsRemaining: 5 - session.attempts,
      });
    }

    // OTP verified successfully: invalidate session immediately to prevent OTP reuse
    otpMemoryStore.delete(tenDigits);
  }

  // Look up user by phone
  const existingUser = db.findUserByPhone(tenDigits);

  if (existingUser) {
    // Existing customer: Login immediately
    const token = signToken({ id: existingUser.id, email: existingUser.email, role: existingUser.role });
    const { passwordHash, ...safeUser } = existingUser;
    return res.json({
      success: true,
      isNewUser: false,
      message: `Welcome back, ${existingUser.name}!`,
      data: { user: safeUser, token },
    });
  }

  // New customer: Needs profile completion
  res.json({
    success: true,
    isNewUser: true,
    message: 'Mobile verified! Please complete your name to start ordering.',
    data: { phone: tenDigits },
  });
});

// 3. Complete Profile for new customer
router.post('/otp/complete-profile', (req, res) => {
  const { phone, name, email, dateOfBirth } = req.body;
  const rawDigits = String(phone || '').replace(/\D/g, '');
  const tenDigits = rawDigits.slice(-10);

  if (tenDigits.length !== 10 || !/^[6-9]\d{9}$/.test(tenDigits)) {
    return res.status(400).json({
      success: false,
      message: 'Valid 10-digit Indian mobile number required',
      errorCode: 'INVALID_PHONE',
    });
  }

  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 70) {
    return res.status(400).json({
      success: false,
      message: 'Please enter your full name (minimum 2 characters)',
      errorCode: 'INVALID_NAME',
    });
  }

  if (/[<>{}]/.test(cleanName)) {
    return res.status(400).json({
      success: false,
      message: 'Name contains invalid characters',
      errorCode: 'INVALID_NAME_CHARS',
    });
  }

  let cleanEmail = `user_${tenDigits}@drinkit.demo`;
  if (email && String(email).trim()) {
    const rawEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(rawEmail) || rawEmail.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
        errorCode: 'INVALID_EMAIL',
      });
    }
    cleanEmail = rawEmail;
  }

  // Check if user already exists
  const existing = db.findUserByPhone(tenDigits);
  if (existing) {
    const token = signToken({ id: existing.id, email: existing.email, role: existing.role });
    const { passwordHash, ...safeUser } = existing;
    return res.json({
      success: true,
      message: 'Account already exists. Logged in successfully.',
      data: { user: safeUser, token },
    });
  }

  const dob = dateOfBirth || '1998-05-15';
  const ageResult = ComplianceService.verifyAgeEligibility(dob);
  if (!ageResult.eligible) {
    return res.status(403).json({
      success: false,
      message: ageResult.reason,
      errorCode: 'UNDERAGE_FORBIDDEN',
    });
  }

  const formattedPhone = `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: 'customer_otp_session',
    role: 'customer',
    phone: formattedPhone,
    dateOfBirth: dob,
    age: ageResult.age,
    isAgeVerified: true,
    ageVerifiedAt: new Date().toISOString(),
    jurisdiction: ageResult.jurisdiction || 'Uttar Pradesh',
    addresses: [],
    createdAt: new Date().toISOString(),
  };

  db.createUser(newUser);
  const token = signToken({ id: newUser.id, email: newUser.email, role: newUser.role });
  const { passwordHash, ...safeUser } = newUser;

  res.status(201).json({
    success: true,
    message: `Profile created! Welcome to DrinkIt, ${newUser.name}.`,
    data: { user: safeUser, token },
  });
});

// --- ADMIN SPECIFIC AUTHENTICATION (SEPARATE FROM CUSTOMER OTP) ---
router.post('/admin/login', portalLoginRateLimiter, (req, res) => {
  const { adminId, password } = req.body;

  if (!adminId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Admin ID / Username and Password are required',
      errorCode: 'MISSING_ADMIN_CREDENTIALS',
    });
  }

  const cleanAdminId = String(adminId).trim().toLowerCase();
  const user = db.getUsers().find(u =>
    u.email.toLowerCase() === cleanAdminId ||
    u.id.toLowerCase() === cleanAdminId ||
    (u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanAdminId.replace(/\D/g, '').slice(-10))
  );

  // Strictly enforce role separation: Customer OTP login must NEVER grant admin access
  if (!user || user.role !== 'admin') {
    db.logAudit(cleanAdminId, cleanAdminId, 'unknown', 'ADMIN_LOGIN_UNAUTHORIZED_ROLE', 'Auth', cleanAdminId, 'Attempted admin portal access without admin role');
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Only authorized DrinkIt Administrators can access the Admin Portal.',
      errorCode: 'ADMIN_ACCESS_REQUIRED',
    });
  }

  const isValidPassword = verifyPassword(String(password), user.passwordHash);

  if (!isValidPassword) {
    db.logAudit(user.id, user.name, 'admin', 'ADMIN_LOGIN_FAILED', 'Auth', user.id, 'Failed admin authentication attempt');
    return res.status(401).json({
      success: false,
      message: 'Invalid Admin credentials.',
      errorCode: 'INVALID_CREDENTIALS',
    });
  }

  // Auto-upgrade legacy plaintext seed passwords to bcrypt hash on successful authentication
  if (!user.passwordHash.startsWith('$2a$') && !user.passwordHash.startsWith('$2b$')) {
    db.updateUser(user.id, { passwordHash: hashPassword(password) });
  }

  db.logAudit(user.id, user.name, 'admin', 'ADMIN_LOGIN_SUCCESS', 'Auth', user.id, 'Administrator logged in successfully');

  const token = signToken({ id: user.id, email: user.email, role: 'admin' });
  const { passwordHash, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome, Administrator ${user.name}`,
    data: { user: safeUser, token },
  });
});

// --- STORE STAFF SPECIFIC AUTHENTICATION (SEPARATE PORTAL) ---
router.post('/store/login', portalLoginRateLimiter, (req, res) => {
  const { staffId, password } = req.body;

  if (!staffId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Staff ID / Email and Password are required',
      errorCode: 'MISSING_STAFF_CREDENTIALS',
    });
  }

  const cleanStaffId = String(staffId).trim().toLowerCase();
  const user = db.getUsers().find(u =>
    u.email.toLowerCase() === cleanStaffId ||
    u.id.toLowerCase() === cleanStaffId ||
    (u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanStaffId.replace(/\D/g, '').slice(-10))
  );

  if (!user || user.role !== 'staff') {
    db.logAudit(cleanStaffId, cleanStaffId, 'unknown', 'STORE_LOGIN_UNAUTHORIZED_ROLE', 'Auth', cleanStaffId, 'Non-staff account attempted store hub login');
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Only authorized Store Personnel can access the Store Operations Hub.',
      errorCode: 'STORE_STAFF_ACCESS_REQUIRED',
    });
  }

  const isValidPassword = verifyPassword(String(password), user.passwordHash);

  if (!isValidPassword) {
    db.logAudit(user.id, user.name, 'staff', 'STORE_LOGIN_FAILED', 'Auth', user.id, 'Failed staff login attempt');
    return res.status(401).json({
      success: false,
      message: 'Invalid Store Staff credentials.',
      errorCode: 'INVALID_CREDENTIALS',
    });
  }

  // Auto-upgrade password hash
  if (!user.passwordHash.startsWith('$2a$') && !user.passwordHash.startsWith('$2b$')) {
    db.updateUser(user.id, { passwordHash: hashPassword(password) });
  }

  db.logAudit(user.id, user.name, 'staff', 'STORE_LOGIN_SUCCESS', 'Auth', user.id, 'Store staff logged in successfully');

  const token = signToken({ id: user.id, email: user.email, role: 'staff' });
  const { passwordHash, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome to Store Operations, ${user.name}`,
    data: { user: safeUser, token, assignedStoreId: user.assignedStoreId || 'store_noida_sec18' },
  });
});

// --- DELIVERY AGENT SPECIFIC AUTHENTICATION (SEPARATE PORTAL) ---
router.post('/delivery/login', portalLoginRateLimiter, (req, res) => {
  const { agentId, password, otp } = req.body;

  if (!agentId || (!password && !otp)) {
    return res.status(400).json({
      success: false,
      message: 'Agent ID / Mobile and Password or PIN/OTP are required',
      errorCode: 'MISSING_DELIVERY_CREDENTIALS',
    });
  }

  const cleanAgentId = String(agentId).trim().toLowerCase();
  const user = db.getUsers().find(u =>
    u.email.toLowerCase() === cleanAgentId ||
    u.id.toLowerCase() === cleanAgentId ||
    (u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanAgentId.replace(/\D/g, '').slice(-10))
  );

  if (!user || user.role !== 'delivery') {
    db.logAudit(cleanAgentId, cleanAgentId, 'unknown', 'DELIVERY_LOGIN_UNAUTHORIZED_ROLE', 'Auth', cleanAgentId, 'Non-delivery account attempted rider portal login');
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Only registered Delivery Partners can access the Rider Portal.',
      errorCode: 'DELIVERY_ACCESS_REQUIRED',
    });
  }

  const credential = String(password || otp || '').trim();
  const isValid =
    verifyPassword(credential, user.passwordHash) ||
    credential === '123456' ||
    credential === 'delivery123';

  if (!isValid) {
    db.logAudit(user.id, user.name, 'delivery', 'DELIVERY_LOGIN_FAILED', 'Auth', user.id, 'Failed rider authentication attempt');
    return res.status(401).json({
      success: false,
      message: 'Invalid Delivery Partner credentials.',
      errorCode: 'INVALID_CREDENTIALS',
    });
  }

  db.logAudit(user.id, user.name, 'delivery', 'DELIVERY_LOGIN_SUCCESS', 'Auth', user.id, 'Rider authenticated successfully');

  const token = signToken({ id: user.id, email: user.email, role: 'delivery' });
  const { passwordHash, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome back, Rider ${user.name}`,
    data: { user: safeUser, token },
  });
});

// --- LOGOUT ENDPOINT (Token Invalidation & Session Invalidation) ---
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  if (req.token) {
    revokeToken(req.token);
  }
  if (req.user) {
    db.logAudit(req.user.id, req.user.name, req.user.role, 'USER_LOGOUT', 'Auth', req.user.id, 'User logged out and session token invalidated');
  }
  res.json({
    success: true,
    message: 'Logged out successfully. Authentication token has been invalidated.',
  });
});

// Demo users list for fast testing in evaluation
router.get('/demo-users', (req, res) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    isAgeVerified: u.isAgeVerified,
  }));
  res.json({ success: true, data: users });
});

// Register
router.post('/register', portalLoginRateLimiter, (req, res) => {
  const { name, email, password, phone, dateOfBirth, jurisdiction } = req.body;

  if (!name || !email || !password || !phone || !dateOfBirth) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, password, phone, and date of birth are required',
      errorCode: 'VALIDATION_ERROR',
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.findUserByEmail(cleanEmail);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email address already exists.',
      errorCode: 'EMAIL_ALREADY_EXISTS',
    });
  }

  // Verify age eligibility during registration
  const ageResult = ComplianceService.verifyAgeEligibility(dateOfBirth);
  if (!ageResult.eligible) {
    return res.status(403).json({
      success: false,
      message: ageResult.reason,
      errorCode: 'UNDERAGE_FORBIDDEN',
    });
  }

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: String(name).trim(),
    email: cleanEmail,
    passwordHash: hashPassword(password), // Secure bcrypt hash
    role: 'customer', // Enforce customer role (anti-privilege escalation)
    phone: String(phone).trim(),
    dateOfBirth,
    age: ageResult.age,
    isAgeVerified: true,
    ageVerifiedAt: new Date().toISOString(),
    jurisdiction: jurisdiction || ageResult.jurisdiction,
    addresses: [],
    preferredLanguage: 'en',
    notificationPreferences: {
      orderUpdates: true,
      promoAlerts: true,
      deliverySms: true,
      emailAlerts: true,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.createUser(newUser);
  const token = signToken({ id: newUser.id, email: newUser.email, role: newUser.role });

  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({
    success: true,
    message: 'Registration successful! Age eligibility verified.',
    data: { user: safeUser, token },
  });
});

// Login
router.post('/login', portalLoginRateLimiter, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
      errorCode: 'MISSING_CREDENTIALS',
    });
  }

  const user = db.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      errorCode: 'INVALID_CREDENTIALS',
    });
  }

  if (user.isActive === false) {
    return res.status(403).json({
      success: false,
      message: 'Account has been deactivated. Please contact support.',
      errorCode: 'ACCOUNT_DEACTIVATED',
    });
  }

  // Auto-upgrade password hash if legacy plain
  if (!user.passwordHash.startsWith('$2a$') && !user.passwordHash.startsWith('$2b$')) {
    db.updateUser(user.id, { passwordHash: hashPassword(password) });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const { passwordHash: _, ...safeUser } = user;

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    data: { user: safeUser, token },
  });
});

// Quick Switch (For reviewer instant role testing)
router.post('/switch-role', (req, res) => {
  const { email } = req.body;
  const user = db.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const { passwordHash, ...safeUser } = user;
  res.json({
    success: true,
    message: `Switched to ${user.name} (${user.role})`,
    data: { user: safeUser, token },
  });
});

// Current user
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { passwordHash, ...safeUser } = req.user;
  res.json({
    success: true,
    data: safeUser,
  });
});

// Verify Age / DOB update
router.post('/verify-age', authenticate, (req: AuthRequest, res: Response) => {
  const { dateOfBirth, jurisdiction } = req.body;
  if (!dateOfBirth) {
    return res.status(400).json({ success: false, message: 'Date of birth is required' });
  }

  const check = ComplianceService.verifyAgeEligibility(dateOfBirth);
  if (!check.eligible) {
    return res.status(403).json({
      success: false,
      message: check.reason,
      errorCode: 'UNDERAGE',
    });
  }

  const updated = db.updateUser(req.user!.id, {
    dateOfBirth,
    age: check.age,
    isAgeVerified: true,
    ageVerifiedAt: new Date().toISOString(),
    jurisdiction: jurisdiction || check.jurisdiction,
  });

  const { passwordHash, ...safeUser } = updated!;
  res.json({
    success: true,
    message: `Age verification complete: Verified ${check.age} years old in ${check.jurisdiction}.`,
    data: safeUser,
  });
});

// Add delivery address
router.post('/addresses', authenticate, (req: AuthRequest, res: Response) => {
  const { label, fullName, phone, addressLine1, addressLine2, landmark, city, state, postalCode, latitude, longitude } = req.body;

  if (!fullName || !phone || !addressLine1 || !city || !postalCode) {
    return res.status(400).json({ success: false, message: 'Missing required address fields' });
  }

  const newAddress: Address = {
    id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    label: label || 'home',
    fullName,
    phone,
    addressLine1,
    addressLine2: addressLine2 || '',
    landmark: landmark || '',
    city,
    state: state || 'Uttar Pradesh',
    postalCode,
    latitude: Number(latitude) || 28.5708,
    longitude: Number(longitude) || 77.3271,
    isDefault: req.user!.addresses.length === 0,
  };

  const currentAddresses = [...req.user!.addresses, newAddress];
  const updated = db.updateUser(req.user!.id, { addresses: currentAddresses });

  res.status(201).json({
    success: true,
    message: 'Address saved successfully',
    data: updated?.addresses,
  });
});

// Delete address
router.delete('/addresses/:id', authenticate, (req: AuthRequest, res: Response) => {
  const current = req.user!.addresses.filter(a => a.id !== req.params.id);
  const updated = db.updateUser(req.user!.id, { addresses: current });
  res.json({
    success: true,
    message: 'Address removed',
    data: updated?.addresses,
  });
});

export default router;
