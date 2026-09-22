import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const notifs = db.getNotifications().filter(n => n.userId === req.user!.id);
  res.json({ success: true, data: notifs });
});

router.post('/:id/read', authenticate, (req: AuthRequest, res: Response) => {
  db.markNotificationAsRead(req.params.id);
  res.json({ success: true, message: 'Notification marked as read' });
});

export default router;
