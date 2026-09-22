import { db } from '../db/database.ts';

export interface AgeVerificationResult {
  eligible: boolean;
  age: number;
  minimumRequiredAge: number;
  jurisdiction: string;
  reason?: string;
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
  public static verifyAgeEligibility(dobString: string): AgeVerificationResult {
    const settings = db.getComplianceSettings();
    const age = this.calculateAge(dobString);
    const minAge = settings.legalDrinkingAge;

    if (age < minAge) {
      return {
        eligible: false,
        age,
        minimumRequiredAge: minAge,
        jurisdiction: settings.jurisdiction,
        reason: `Underage: You are ${age} years old. The legal drinking age in ${settings.jurisdiction} is ${minAge}. Alcohol delivery strictly prohibited for minors.`,
      };
    }

    return {
      eligible: true,
      age,
      minimumRequiredAge: minAge,
      jurisdiction: settings.jurisdiction,
    };
  }

  /**
   * Checks order constraints for state alcohol compliance
   */
  public static checkOrderCompliance(cartItems: { productId: string; quantity: number }[]): {
    permitted: boolean;
    reason?: string;
  } {
    const settings = db.getComplianceSettings();

    // 1. Dry day enforcement
    if (settings.dryDayActive) {
      return {
        permitted: false,
        reason: `Dry Day Notice: Alcohol delivery is legally halted today due to "${settings.dryDayReason || 'Government / Electoral notification'}".`,
      };
    }

    // 2. Maximum bottles per order limitation
    const products = db.getProducts();
    let totalAlcoholicUnits = 0;

    for (const item of cartItems) {
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.isAlcoholic) {
        totalAlcoholicUnits += item.quantity;
      }
    }

    if (totalAlcoholicUnits > settings.maxBottlesPerOrder) {
      return {
        permitted: false,
        reason: `Excise Regulatory Limit: You cannot order more than ${settings.maxBottlesPerOrder} bottles of alcoholic beverages in a single transaction. Current quantity: ${totalAlcoholicUnits}.`,
      };
    }

    return { permitted: true };
  }
}
