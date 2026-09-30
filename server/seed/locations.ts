import { Store, DeliveryZone, PlatformComplianceSettings } from '../types.ts';

const store = (
  id: string,
  code: string,
  city: string,
  state: string,
  postalCodes: string[],
  latitude: number,
  longitude: number,
  area: string,
): Store => ({
  id,
  name: `DrinkIt Hub — ${city} (${area})`,
  code,
  address: `Licensed Micro-Warehouse, ${area}, ${city}`,
  area,
  city,
  state,
  postalCodes,
  latitude,
  longitude,
  serviceRadiusKm: 8,
  operatingHours: { open: '10:00', close: '22:30' },
  isActive: true,
  deliveryEnabled: true,
});

export const SEED_STORES: Store[] = [
  // 11 Uttar Pradesh Hubs
  store('store_noida_sec18', 'UP-NOIDA18', 'Noida', 'Uttar Pradesh', ['201301', '201303', '201304', '201307'], 28.5708, 77.3260, 'Sector 18 & NCR Core'),
  store('store_greater_noida', 'UP-GNOIDA', 'Greater Noida', 'Uttar Pradesh', ['201306', '201310', '201308'], 28.4744, 77.5030, 'Alpha & Pari Chowk'),
  store('store_ghaziabad', 'UP-GZB', 'Ghaziabad', 'Uttar Pradesh', ['201001', '201002', '201010', '201014'], 28.6692, 77.4538, 'Raj Nagar & Indirapuram'),
  store('store_lucknow', 'UP-LKO', 'Lucknow', 'Uttar Pradesh', ['226001', '226010', '226016', '226024'], 26.8467, 80.9462, 'Hazratganj & Gomti Nagar'),
  store('store_kanpur', 'UP-KNP', 'Kanpur', 'Uttar Pradesh', ['208001', '208002', '208005'], 26.4499, 80.3319, 'Swaroop Nagar & Civil Lines'),
  store('store_agra', 'UP-AGRA', 'Agra', 'Uttar Pradesh', ['282001', '282002', '282005'], 27.1767, 78.0081, 'Sanjay Place & Tajganj'),
  store('store_varanasi', 'UP-VNS', 'Varanasi', 'Uttar Pradesh', ['221001', '221002', '221005'], 25.3176, 82.9739, 'Sigra & Cantt'),
  store('store_prayagraj', 'UP-PRY', 'Prayagraj', 'Uttar Pradesh', ['211001', '211002', '211003'], 25.4358, 81.8463, 'Civil Lines & Katra'),
  store('store_meerut', 'UP-MRT', 'Meerut', 'Uttar Pradesh', ['250001', '250002', '250004'], 28.9845, 77.7064, 'Civil Lines & Shastri Nagar'),
  store('store_bareilly', 'UP-BLY', 'Bareilly', 'Uttar Pradesh', ['243001', '243003', '243005'], 28.3670, 79.4304, 'Civil Lines & Rampur Garden'),
  store('store_gorakhpur', 'UP-GKP', 'Gorakhpur', 'Uttar Pradesh', ['273001', '273002', '273003'], 26.7606, 83.3732, 'Golghar & Civil Lines'),

  // 6 Delhi Hubs
  store('store_new_delhi', 'DL-CENTRAL', 'New Delhi', 'Delhi', ['110001', '110002', '110003', '110017'], 28.6139, 77.2090, 'Barakhamba & Chanakyapuri'),
  store('store_north_delhi', 'DL-NORTH', 'North Delhi', 'Delhi', ['110007', '110009', '110033'], 28.7041, 77.1025, 'Civil Lines & Model Town'),
  store('store_south_delhi', 'DL-SOUTH', 'South Delhi', 'Delhi', ['110016', '110019', '110025', '110048'], 28.5355, 77.2505, 'Saket, GK & Hauz Khas'),
  store('store_east_delhi', 'DL-EAST', 'East Delhi', 'Delhi', ['110031', '110032', '110092'], 28.6280, 77.2770, 'Preet Vihar & Mayur Vihar'),
  store('store_west_delhi', 'DL-WEST', 'West Delhi', 'Delhi', ['110018', '110027', '110041'], 28.6692, 77.1230, 'Rajouri Garden & Punjabi Bagh'),
  store('store_central_delhi', 'DL-CP', 'Central Delhi', 'Delhi', ['110005', '110006', '110008', '110055'], 28.6448, 77.2167, 'Connaught Place & Karol Bagh'),
];

export const SEED_DELIVERY_ZONES: DeliveryZone[] = SEED_STORES.map((s) => ({
  id: `zone_${s.id}`,
  name: `${s.city} Service Zone`,
  city: s.city,
  state: s.state,
  postalCodes: s.postalCodes,
  associatedStoreId: s.id,
  isActive: true,
  minOrderValue: 199,
  baseDeliveryFee: 35,
}));

export const SEED_COMPLIANCE_SETTINGS: PlatformComplianceSettings = {
  legalDrinkingAge: 21,
  jurisdiction: 'Uttar Pradesh & Delhi NCR Licensed Jurisdictions',
  dryDayActive: false,
  dryDayReason: '',
  maxBottlesPerOrder: 6,
  maxVolumeLitresPerOrder: 9,
  operatingHoursOnly: true,
  operatingHoursStart: '10:00',
  operatingHoursEnd: '22:30',
  requireIdProofAtDoorstep: true,
  verificationExpiryDays: 365,
  restrictedPostalCodes: [],
  exciseLicenseNumber: 'UP-EXCISE-LKO-2026-9812 / DL-EXCISE-CENTRAL-4421',
  exciseLicenseValidUntil: '2027-03-31',
};
