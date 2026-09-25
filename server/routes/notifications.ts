import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// All notifications endpoints require authentication
router.use(authenticate);

// GET all notifications for authenticated customer
router.get('/', (req: AuthRequest, res: Response) => {
  const notifs = db.getNotifications().filter(n => n.userId === req.user!.id);
  res.json({ success: true, data: notifs });
});

// GET specific notification by ID with strict ownership check
router.get('/:id', (req: AuthRequest, res: Response) => {
  const notif = db.findNotificationById(req.params.id);
  if (!notif) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  // Strict resource ownership check: Customer A requesting Customer B's notification must be rejected
  if (notif.userId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to access another user’s notification.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  res.json({ success: true, data: notif });
});

// Mark notification as read with strict ownership check
router.post('/:id/read', (req: AuthRequest, res: Response) => {
  const notif = db.findNotificationById(req.params.id);
  if (!notif) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  // Strict resource ownership check
  if (notif.userId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You cannot modify another user’s notifications.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  db.markNotificationAsRead(req.params.id);
  res.json({ success: true, message: 'Notification marked as read' });
});

export default router;
