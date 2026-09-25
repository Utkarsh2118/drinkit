import { Router, Request, Response } from 'express';
import { db } from '../db/database.ts';
import { ComplianceService } from '../services/compliance.ts';

const router = Router();

/**
 * Public compliance info endpoint for storefront, cart drawer, age modal, and banners
 */
router.get('/', (_req: Request, res: Response) => {
  const settings = db.getComplianceSettings();
  const operatingStatus = ComplianceService.checkOperatingHours(
    settings.operatingHoursStart,
    settings.operatingHoursEnd
  );

  res.json({
    success: true,
    data: {
      ...settings,
      operatingStatus,
      statutoryWarnings: [
        'Consumption of alcohol is injurious to health. Be safe — do not drink and drive.',
        `Legal drinking age in ${settings.jurisdiction}: ${settings.legalDrinkingAge} years. Valid original photo ID is mandatory at delivery.`,
        'Underage delivery and delivery to intoxicated persons is strictly prohibited under State Excise Laws.',
      ],
    },
  });
});

/**
 * Cart compliance pre-flight check endpoint
 */
router.post('/check-cart', (req: Request, res: Response) => {
  const { items, postalCode } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'Invalid cart items' });
  }

  const result = ComplianceService.checkOrderCompliance(items, postalCode);
  res.json({
    success: true,
    data: result,
  });
});

export default router;
