import { Router, Response } from 'express';
import { db } from '../db/database.ts';
import { authenticate, AuthRequest } from '../middleware/auth.ts';
import { DeliveryEstimationService } from '../services/deliveryEstimate.ts';
import { Address } from '../types.ts';

const router = Router();

// All address routes require customer authentication
router.use(authenticate);

/**
 * Validate address fields server-side
 */
function validateAddressPayload(body: any): { isValid: boolean; error?: string; cleanAddress?: Partial<Address> } {
  const {
    label,
    fullName,
    recipientName,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    area,
    city,
    state,
    postalCode,
    latitude,
    longitude,
    deliveryInstructions,
    isDefault,
  } = body;

  const resolvedName = (recipientName || fullName || '').trim();
  if (!resolvedName || resolvedName.length < 2) {
    return { isValid: false, error: 'Recipient name is required (minimum 2 characters).' };
  }

  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return { isValid: false, error: 'A valid 10-digit phone number is required.' };
  }

  const cleanLine1 = String(addressLine1 || '').trim();
  if (!cleanLine1 || cleanLine1.length < 3) {
    return { isValid: false, error: 'Address line 1 is required.' };
  }

  const cleanCity = String(city || '').trim();
  if (!cleanCity) {
    return { isValid: false, error: 'City is required.' };
  }

  const cleanPostalCode = String(postalCode || '').replace(/\D/g, '');
  if (cleanPostalCode.length !== 6) {
    return { isValid: false, error: 'A valid 6-digit postal PIN code is required.' };
  }

  const latNum = parseFloat(String(latitude));
  const lonNum = parseFloat(String(longitude));
  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return { isValid: false, error: 'Valid geographic coordinates (latitude and longitude) are required.' };
  }

  const formattedPhone = `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;

  return {
    isValid: true,
    cleanAddress: {
      label: (label || 'home').toLowerCase().trim(),
      fullName: resolvedName,
      recipientName: resolvedName,
      phone: formattedPhone,
      addressLine1: cleanLine1,
      addressLine2: addressLine2 ? String(addressLine2).trim() : '',
      landmark: landmark ? String(landmark).trim() : '',
      area: area ? String(area).trim() : '',
      city: cleanCity,
      state: state ? String(state).trim() : 'Karnataka',
      postalCode: cleanPostalCode,
      latitude: latNum,
      longitude: lonNum,
      deliveryInstructions: deliveryInstructions ? String(deliveryInstructions).trim() : undefined,
      isDefault: Boolean(isDefault),
    },
  };
}

/**
 * GET /api/addresses
 * Retrieve all delivery addresses saved by the authenticated user
 */
router.get('/', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const addresses = db.getUserAddresses(user.id);
  res.json({
    success: true,
    data: addresses,
  });
});

/**
 * POST /api/addresses
 * Add a new delivery address with server-side ownership enforcement & single-default logic
 */
router.post('/', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const validation = validateAddressPayload(req.body);

  if (!validation.isValid || !validation.cleanAddress) {
    return res.status(400).json({
      success: false,
      message: validation.error || 'Address validation failed.',
      errorCode: 'INVALID_ADDRESS_PAYLOAD',
    });
  }

  const nowIso = new Date().toISOString();
  const newAddress: Address = {
    id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...validation.cleanAddress,
    createdAt: nowIso,
    updatedAt: nowIso,
  } as Address;

  const updatedAddresses = db.addUserAddress(user.id, newAddress);

  res.status(201).json({
    success: true,
    message: 'Delivery address saved successfully.',
    data: updatedAddresses,
    address: newAddress,
  });
});

/**
 * PUT /api/addresses/:id
 * Edit an existing address belonging to the authenticated customer
 */
router.put('/:id', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const addressId = req.params.id;

  const existingAddresses = db.getUserAddresses(user.id);
  const targetAddress = existingAddresses.find(a => a.id === addressId);

  if (!targetAddress) {
    return res.status(404).json({
      success: false,
      message: 'Address not found or does not belong to your account.',
      errorCode: 'ADDRESS_NOT_FOUND',
    });
  }

  const validation = validateAddressPayload({
    ...targetAddress,
    ...req.body,
  });

  if (!validation.isValid || !validation.cleanAddress) {
    return res.status(400).json({
      success: false,
      message: validation.error || 'Address update validation failed.',
      errorCode: 'INVALID_ADDRESS_PAYLOAD',
    });
  }

  const updatedAddresses = db.updateUserAddress(user.id, addressId, validation.cleanAddress);

  res.json({
    success: true,
    message: 'Delivery address updated successfully.',
    data: updatedAddresses,
  });
});

/**
 * DELETE /api/addresses/:id
 * Delete a saved delivery address belonging to the authenticated customer
 */
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const addressId = req.params.id;

  const updatedAddresses = db.deleteUserAddress(user.id, addressId);
  if (!updatedAddresses) {
    return res.status(404).json({
      success: false,
      message: 'Address not found or does not belong to your account.',
      errorCode: 'ADDRESS_NOT_FOUND',
    });
  }

  res.json({
    success: true,
    message: 'Delivery address deleted successfully.',
    data: updatedAddresses,
  });
});

/**
 * PATCH /api/addresses/:id/default
 * Set a specific address as the primary default delivery address
 */
router.patch('/:id/default', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const addressId = req.params.id;

  const updatedAddresses = db.setDefaultUserAddress(user.id, addressId);
  if (!updatedAddresses) {
    return res.status(404).json({
      success: false,
      message: 'Address not found or does not belong to your account.',
      errorCode: 'ADDRESS_NOT_FOUND',
    });
  }

  res.json({
    success: true,
    message: 'Default delivery address updated.',
    data: updatedAddresses,
  });
});

/**
 * POST /api/addresses/validate-serviceability
 * Check if given coordinates or postal code are within active delivery service area
 */
router.post('/validate-serviceability', (req: AuthRequest, res: Response) => {
  const { latitude, longitude, postalCode } = req.body;

  const latNum = parseFloat(String(latitude));
  const lonNum = parseFloat(String(longitude));
  const stores = db.getStores();

  let matchedStore = stores[0];
  let isDeliverable = false;

  if (postalCode) {
    const matchedZone = db.getDeliveryZones().find(z => z.postalCodes.includes(String(postalCode)) && z.isActive);
    if (matchedZone) {
      const store = stores.find(s => s.id === matchedZone.associatedStoreId && s.isActive && s.deliveryEnabled);
      if (store) {
        matchedStore = store;
        isDeliverable = true;
      }
    }
  }

  if (!isNaN(latNum) && !isNaN(lonNum)) {
    const nearest = DeliveryEstimationService.findNearestStore(stores, latNum, lonNum);
    if (nearest) {
      const est = DeliveryEstimationService.estimateDelivery(nearest.store, latNum, lonNum);
      if (est.isDeliverable) {
        matchedStore = nearest.store;
        isDeliverable = true;
      }
    }
  }

  const estimate = DeliveryEstimationService.estimateDelivery(
    matchedStore,
    !isNaN(latNum) ? latNum : matchedStore.latitude + 0.01,
    !isNaN(lonNum) ? lonNum : matchedStore.longitude + 0.01
  );

  const finalDeliverable = isDeliverable || estimate.isDeliverable;

  res.json({
    success: true,
    data: {
      isServiceable: finalDeliverable,
      store: matchedStore,
      deliveryEstimate: estimate,
      message: finalDeliverable
        ? `Delivering in ${estimate.estimatedRange} from ${matchedStore.name}`
        : 'Sorry, DrinkIt is currently unavailable at this location.',
    },
  });
});

export default router;
