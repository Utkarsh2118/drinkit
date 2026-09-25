import { db } from '../db/database.ts';

export interface AgeVerificationResult {
  eligible: boolean;
  age: number;
  minimumRequiredAge: number;
  jurisdiction: string;
  reason?: string;
}

export interface OrderComplianceResult {
  permitted: boolean;
  reason?: string;
  errorCode?: string;
  totalAlcoholicBottles?: number;
  totalAlcoholicLitres?: number;
  dryDayActive?: boolean;
  operatingHoursClosed?: boolean;
}

export class ComplianceService {
  /**
   * Calculates precise age from YYYY-MM-DD
   */
  public static calculateAge(dobString: string): number {
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Verifies if customer meets the legal drinking age for the active jurisdiction
   */
  public static verifyAgeEligibility(dobString: string, requestedJurisdiction?: string): AgeVerificationResult {
    const settings = db.getComplianceSettings();
    const age = this.calculateAge(dobString);
    const minAge = settings.legalDrinkingAge || 21;
    const jurisdiction = requestedJurisdiction || settings.jurisdiction || 'UP + Delhi NCR';

    if (age < minAge) {
      return {
        eligible: false,
        age,
        minimumRequiredAge: minAge,
        jurisdiction,
        reason: `Underage: You are ${age} years old. The legal drinking age in ${jurisdiction} is ${minAge}. Alcohol delivery is strictly prohibited for minors under the State Excise Act.`,
      };
    }

    return {
      eligible: true,
      age,
      minimumRequiredAge: minAge,
      jurisdiction,
    };
  }

  /**
   * Parses unit bottle count and volume in litres from strings like "750 ml", "6 x 330 ml", "1 L"
   */
  public static parseProductUnitsAndLitres(volumeStr: string): { bottles: number; litres: number } {
    if (!volumeStr) return { bottles: 1, litres: 0.75 };
    const str = volumeStr.toLowerCase().trim();

    // Multi-pack pattern: "6 x 330 ml" or "4 x 500 ml"
    const packMatch = str.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|l|ltr)/);
    if (packMatch) {
      const count = parseInt(packMatch[1], 10);
      const unitSize = parseFloat(packMatch[2]);
      const unitType = packMatch[3];
      const totalMl = unitType.startsWith('l') ? count * unitSize * 1000 : count * unitSize;
      return { bottles: count, litres: Math.round((totalMl / 1000) * 100) / 100 };
    }

    // Single bottle pattern: "750 ml", "1 l", "500ml"
    const singleMatch = str.match(/(\d+(?:\.\d+)?)\s*(ml|l|ltr)/);
    if (singleMatch) {
      const val = parseFloat(singleMatch[1]);
      const unitType = singleMatch[2];
      const totalMl = unitType.startsWith('l') ? val * 1000 : val;
      return { bottles: 1, litres: Math.round((totalMl / 1000) * 100) / 100 };
    }

    return { bottles: 1, litres: 0.75 };
  }

  /**
   * Evaluates if current time is within excise-permitted delivery hours
   */
  public static checkOperatingHours(startStr: string = '10:00', endStr: string = '22:30'): {
    isOpen: boolean;
    current: string;
    start: string;
    end: string;
  } {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = (startStr || '10:00').split(':').map(Number);
    const [endH, endM] = (endStr || '22:30').split(':').map(Number);

    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    const isOpen = currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
    const currentFormatted = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

    return {
      isOpen,
      current: currentFormatted,
      start: startStr,
      end: endStr,
    };
  }

  /**
   * Checks order constraints for state alcohol compliance:
   * 1. Dry Day enforcement (immediate lockout of alcoholic sales)
   * 2. Operating hours restriction (state excise permitted delivery windows)
   * 3. Maximum statutory bottles per order
   * 4. Maximum volume in litres per order
   * 5. Prohibited / restricted postal codes
   */
  public static checkOrderCompliance(
    cartItems: { productId: string; quantity: number }[],
    deliveryPostalCode?: string
  ): OrderComplianceResult {
    const settings = db.getComplianceSettings();

    // Find any alcoholic items in cart
    const products = db.getProducts();
    let totalAlcoholicBottles = 0;
    let totalAlcoholicLitres = 0;
    let hasAlcoholicProduct = false;

    for (const item of cartItems) {
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.isAlcoholic) {
        hasAlcoholicProduct = true;
        const parsed = this.parseProductUnitsAndLitres(prod.volume);
        totalAlcoholicBottles += parsed.bottles * item.quantity;
        totalAlcoholicLitres += parsed.litres * item.quantity;
      }
    }

    // If order contains no alcohol (e.g. only tonic, bar snacks, soft drinks), skip alcohol excise rules
    if (!hasAlcoholicProduct) {
      return { permitted: true, totalAlcoholicBottles: 0, totalAlcoholicLitres: 0 };
    }

    // 1. Dry Day enforcement
    if (settings.dryDayActive) {
      return {
        permitted: false,
        dryDayActive: true,
        errorCode: 'DRY_DAY_RESTRICTION',
        reason: `Dry Day Statutory Notice: Alcohol ordering and delivery is legally halted today due to "${settings.dryDayReason || 'State Excise / Electoral notification'}".`,
      };
    }

    // 2. Permitted Operating Hours check (if enabled in settings)
    if (settings.operatingHoursOnly) {
      const hoursCheck = this.checkOperatingHours(settings.operatingHoursStart, settings.operatingHoursEnd);
      if (!hoursCheck.isOpen) {
        return {
          permitted: false,
          operatingHoursClosed: true,
          errorCode: 'OUTSIDE_OPERATING_HOURS',
          reason: `Excise Delivery Hours Restriction: State Excise Law strictly permits alcohol delivery between ${hoursCheck.start} and ${hoursCheck.end}. Current time: ${hoursCheck.current}. Alcohol orders will resume at ${hoursCheck.start}.`,
        };
      }
    }

    // 3. Maximum statutory bottles per transaction
    const maxBottles = settings.maxBottlesPerOrder || 6;
    if (totalAlcoholicBottles > maxBottles) {
      return {
        permitted: false,
        errorCode: 'MAX_BOTTLES_EXCEEDED',
        totalAlcoholicBottles,
        reason: `Excise Regulatory Limit: You cannot order more than ${maxBottles} bottles of alcoholic beverages in a single transaction under State Excise rules. Your cart currently has ${totalAlcoholicBottles} bottles.`,
      };
    }

    // 4. Maximum volume in litres
    const maxLitres = settings.maxVolumeLitresPerOrder || 9.0;
    if (totalAlcoholicLitres > maxLitres) {
      return {
        permitted: false,
        errorCode: 'MAX_VOLUME_EXCEEDED',
        totalAlcoholicLitres,
        reason: `Excise Retail Ceiling: State retail transport limits maximum alcohol volume to ${maxLitres}L per order. Your order contains ${totalAlcoholicLitres.toFixed(2)}L.`,
      };
    }

    // 5. Restricted / Prohibition Postal Codes
    if (deliveryPostalCode && settings.restrictedPostalCodes && settings.restrictedPostalCodes.length > 0) {
      const cleanPostal = String(deliveryPostalCode).trim();
      const isRestricted = settings.restrictedPostalCodes.some(
        code => String(code).trim() === cleanPostal
      );
      if (isRestricted) {
        return {
          permitted: false,
          errorCode: 'RESTRICTED_POSTAL_CODE',
          reason: `Excise Jurisdiction Restriction: Alcohol delivery is legally prohibited in postal code ${cleanPostal} (Prohibition / Non-Permitted Zone).`,
        };
      }
    }

    return {
      permitted: true,
      totalAlcoholicBottles,
      totalAlcoholicLitres: Math.round(totalAlcoholicLitres * 100) / 100,
    };
  }
}

