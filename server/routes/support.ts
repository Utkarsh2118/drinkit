import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.ts';
import { supportTicketRateLimiter } from '../middleware/security.ts';
import { SupportTicket, SupportTicketMessage } from '../types.ts';

const router = Router();

// All support endpoints require authentication
router.use(authenticate);

/**
 * GET /api/support/tickets
 * Retrieve authenticated customer's own support tickets
 */
router.get('/tickets', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  // Strict ownership enforcement: Customers only see their own tickets
  const tickets = db.getUserSupportTickets(user.id);
  res.json({
    success: true,
    data: tickets,
  });
});

/**
 * GET /api/support/tickets/:id
 * Retrieve single support ticket with strict ownership check
 */
router.get('/tickets/:id', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const ticket = db.findSupportTicketById(req.params.id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found.',
      errorCode: 'TICKET_NOT_FOUND',
    });
  }

  // Strict ownership check: Customer A requesting Customer B's ticket is rejected
  if (user.role === 'customer' && ticket.userId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have permission to access another customer’s support ticket.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  res.json({
    success: true,
    data: ticket,
  });
});

/**
 * POST /api/support/tickets
 * Create a new customer support ticket
 */
router.post('/tickets', supportTicketRateLimiter, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { category, subject, message, orderId, priority } = req.body;

  if (!subject || String(subject).trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Subject is required (minimum 3 characters).',
      errorCode: 'INVALID_SUBJECT',
    });
  }

  if (!message || String(message).trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Description message is required (minimum 5 characters).',
      errorCode: 'INVALID_MESSAGE',
    });
  }

  const validCategories = ['order', 'delivery', 'payment', 'product', 'account', 'other'];
  const resolvedCategory = validCategories.includes(category) ? category : 'other';

  // If orderId is provided, verify ownership of the order
  if (orderId) {
    const order = db.findOrderById(orderId);
    if (!order || (user.role === 'customer' && order.userId !== user.id)) {
      return res.status(400).json({
        success: false,
        message: 'The specified order does not belong to your account.',
        errorCode: 'INVALID_ORDER_REFERENCE',
      });
    }
  }

  const nowIso = new Date().toISOString();
  const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 90000)}`;

  const initialMessage: SupportTicketMessage = {
    id: `msg_${Date.now()}_1`,
    senderId: user.id,
    senderName: user.name,
    senderRole: user.role,
    message: String(message).trim(),
    timestamp: nowIso,
  };

  const newTicket: SupportTicket = {
    id: ticketId,
    ticketNumber,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone,
    orderId: orderId || undefined,
    category: resolvedCategory as any,
    subject: String(subject).trim(),
    status: 'OPEN',
    priority: priority === 'HIGH' || priority === 'URGENT' ? priority : 'MEDIUM',
    messages: [initialMessage],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const created = db.createSupportTicket(newTicket);

  res.status(201).json({
    success: true,
    message: `Support ticket ${ticketNumber} created successfully. Our team will review it shortly.`,
    data: created,
  });
});

/**
 * POST /api/support/tickets/:id/message
 * Reply to a support ticket
 */
router.post('/tickets/:id/message', supportTicketRateLimiter, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const ticket = db.findSupportTicketById(req.params.id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Support ticket not found.',
      errorCode: 'TICKET_NOT_FOUND',
    });
  }

  // Ownership verification: Customer can only message on their own ticket; Admin can message on any ticket
  if (user.role === 'customer' && ticket.userId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You cannot post messages on another customer’s ticket.',
      errorCode: 'FORBIDDEN_RESOURCE_OWNERSHIP',
    });
  }

  const { message } = req.body;
  if (!message || String(message).trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Message content is required.',
      errorCode: 'INVALID_MESSAGE',
    });
  }

  const newMessage: SupportTicketMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: user.id,
    senderName: user.name,
    senderRole: user.role,
    message: String(message).trim(),
    timestamp: new Date().toISOString(),
  };

  // Re-open ticket if it was resolved and customer replies
  const newStatus = user.role === 'customer' && ticket.status === 'RESOLVED' ? 'OPEN' : undefined;

  const updatedTicket = db.addSupportTicketMessage(ticket.id, newMessage, newStatus);

  res.json({
    success: true,
    message: 'Message added to ticket.',
    data: updatedTicket,
  });
});

/**
 * GET /api/support/admin/tickets
 * Admin view of all tickets across platform
 */
router.get('/admin/tickets', requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  let tickets = db.getSupportTickets();

  if (status) {
    tickets = tickets.filter(t => t.status === status.toUpperCase());
  }

  res.json({
    success: true,
    data: tickets,
  });
});

/**
 * PATCH /api/support/admin/tickets/:id
 * Admin update ticket status or priority
 */
router.patch('/admin/tickets/:id', requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const { status, adminResponse } = req.body;
  const ticket = db.findSupportTicketById(req.params.id);

  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found' });
  }

  if (adminResponse && String(adminResponse).trim()) {
    const replyMessage: SupportTicketMessage = {
      id: `msg_adm_${Date.now()}`,
      senderId: req.user!.id,
      senderName: req.user!.name,
      senderRole: 'admin',
      message: String(adminResponse).trim(),
      timestamp: new Date().toISOString(),
    };
    db.addSupportTicketMessage(ticket.id, replyMessage);
  }

  if (status) {
    db.updateSupportTicketStatus(ticket.id, status, {
      id: req.user!.id,
      name: req.user!.name,
      role: req.user!.role,
    });
  }

  const refreshed = db.findSupportTicketById(ticket.id);
  res.json({
    success: true,
    message: 'Ticket updated by administrator.',
    data: refreshed,
  });
});

export default router;
