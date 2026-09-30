import { db } from '../db/database.ts';
import { Product } from '../types.ts';

export interface PartyBundle {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  items: {
    categorySlot: string;
    product: Product;
    quantity: number;
  }[];
  totalPrice: number;
  totalMrp: number;
  savings: number;
  isAvailable: boolean;
}

export const partyBundleService = {
  getBundlesForStore(storeId: string): PartyBundle[] {
    const store = db.getStores().find(s => s.id === storeId);
    if (!store) return [];

    const getInStockProduct = (filterFn: (p: Product) => boolean): Product | null => {
      const candidates = db.getProducts().filter(p => {
        if (!p.isActive) return false;
        if (p.availableStates?.length && !p.availableStates.includes(store.state)) return false;
        const stock = db.getStoreStock(storeId, p.id);
        return stock.available > 0 && filterFn(p);
      });
      // Prefer bestsellers
      candidates.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
      return candidates[0] || null;
    };

    const bundles: PartyBundle[] = [];

    // 1. House Party Pack: Beer + Chips + Peanuts + Disposable Glasses + Napkins
    const beer = getInStockProduct(p => p.categoryId === 'cat_beer');
    const chips = getInStockProduct(p => p.categoryId === 'cat_snacks' && p.subcategory === 'Potato Chips');
    const peanuts = getInStockProduct(p => p.categoryId === 'cat_nuts');
    const glasses = getInStockProduct(p => p.categoryId === 'cat_party_glasses');
    const napkins = getInStockProduct(p => p.categoryId === 'cat_party_napkins');

    if (beer && chips && peanuts && glasses && napkins) {
      const items = [
        { categorySlot: 'Beer', product: beer, quantity: 2 },
        { categorySlot: 'Potato Chips', product: chips, quantity: 2 },
        { categorySlot: 'Peanuts & Munchies', product: peanuts, quantity: 1 },
        { categorySlot: 'Party Glasses', product: glasses, quantity: 1 },
        { categorySlot: 'Napkins', product: napkins, quantity: 1 },
      ];
      const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const totalMrp = items.reduce((sum, i) => sum + (i.product.mrp || i.product.price) * i.quantity, 0);
      bundles.push({
        id: 'bundle_house_party',
        name: 'House Party Pack',
        tagline: 'Chilled Beers, Hot Crisps, Peanuts, Party Cups & Napkins',
        badge: 'TOP PARTY VALUE',
        items,
        totalPrice,
        totalMrp,
        savings: Math.max(0, totalMrp - totalPrice),
        isAvailable: true,
      });
    }

    // 2. Whisky Night Pack: Whisky + Club Soda + Bisleri Water + Peanuts + Glasses
    const whisky = getInStockProduct(p => p.categoryId === 'cat_whisky');
    const soda = getInStockProduct(p => p.categoryId === 'cat_mixers' && p.subcategory === 'Club Soda');
    const water = getInStockProduct(p => p.categoryId === 'cat_water');
    const masalaPeanuts = getInStockProduct(p => p.categoryId === 'cat_nuts');
    const whiskyGlasses = getInStockProduct(p => p.categoryId === 'cat_party_glasses');

    if (whisky && soda && water && masalaPeanuts && whiskyGlasses) {
      const items = [
        { categorySlot: 'Blended Whisky', product: whisky, quantity: 1 },
        { categorySlot: 'Club Soda', product: soda, quantity: 2 },
        { categorySlot: 'Mineral Water 1L', product: water, quantity: 2 },
        { categorySlot: 'Masala Peanuts', product: masalaPeanuts, quantity: 1 },
        { categorySlot: 'Party Glasses', product: whiskyGlasses, quantity: 1 },
      ];
      const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const totalMrp = items.reduce((sum, i) => sum + (i.product.mrp || i.product.price) * i.quantity, 0);
      bundles.push({
        id: 'bundle_whisky_night',
        name: 'Whisky Night Pack',
        tagline: 'Whisky, Effervescent Club Soda, Chilled Water, Nuts & Tumblers',
        badge: 'WEEKEND SPECIAL',
        items,
        totalPrice,
        totalMrp,
        savings: Math.max(0, totalMrp - totalPrice),
        isAvailable: true,
      });
    }

    // 3. Cocktail Pack: Vodka/Gin + Tonic Water + Soda + Ice Bags + Glasses + Straws
    const spirit = getInStockProduct(p => p.categoryId === 'cat_vodka' || p.categoryId === 'cat_gin');
    const tonic = getInStockProduct(p => p.categoryId === 'cat_mixers' && p.subcategory === 'Tonic Water');
    const cocktailSoda = getInStockProduct(p => p.categoryId === 'cat_mixers');
    const iceBags = getInStockProduct(p => p.id === 'prod_ice_bags_5' || p.categoryId === 'cat_party');
    const cocktailGlasses = getInStockProduct(p => p.categoryId === 'cat_party_glasses');
    const straws = getInStockProduct(p => p.categoryId === 'cat_party_straws');

    if (spirit && tonic && cocktailSoda && cocktailGlasses) {
      const items = [
        { categorySlot: 'Craft Spirit', product: spirit, quantity: 1 },
        { categorySlot: 'Tonic Water', product: tonic, quantity: 2 },
        { categorySlot: 'Mixer', product: cocktailSoda, quantity: 1 },
        ...(iceBags ? [{ categorySlot: 'Ice Bags', product: iceBags, quantity: 1 }] : []),
        { categorySlot: 'Tumbler Glasses', product: cocktailGlasses, quantity: 1 },
        ...(straws ? [{ categorySlot: 'Neon Straws', product: straws, quantity: 1 }] : []),
      ];
      const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const totalMrp = items.reduce((sum, i) => sum + (i.product.mrp || i.product.price) * i.quantity, 0);
      bundles.push({
        id: 'bundle_cocktail_pack',
        name: 'Cocktail Pack',
        tagline: 'Gin / Vodka, Quinine Tonic, Chilled Mixer, Ice Bags & Straws',
        badge: 'MIXOLOGY READY',
        items,
        totalPrice,
        totalMrp,
        savings: Math.max(0, totalMrp - totalPrice),
        isAvailable: true,
      });
    }

    // 4. Birthday Party Pack: Soft Drinks + Chips + Nachos + Paper Plates + Cups + Napkins + Cutlery + Candles
    const softDrink = getInStockProduct(p => p.categoryId === 'cat_softdrinks');
    const partyChips = getInStockProduct(p => p.categoryId === 'cat_snacks');
    const nachos = getInStockProduct(p => p.categoryId === 'cat_nachos');
    const plates = getInStockProduct(p => p.categoryId === 'cat_party_plates');
    const cups = getInStockProduct(p => p.categoryId === 'cat_party_glasses');
    const partyNapkins = getInStockProduct(p => p.categoryId === 'cat_party_napkins');
    const cutlery = getInStockProduct(p => p.categoryId === 'cat_party_cutlery');
    const candles = getInStockProduct(p => p.id === 'prod_birthday_candles_12' || p.categoryId === 'cat_party');

    if (softDrink && partyChips && nachos && plates && cups && partyNapkins) {
      const items = [
        { categorySlot: 'Soft Drinks', product: softDrink, quantity: 2 },
        { categorySlot: 'Chips & Crisps', product: partyChips, quantity: 2 },
        { categorySlot: 'Cheese Nachos', product: nachos, quantity: 1 },
        { categorySlot: 'Paper Plates', product: plates, quantity: 1 },
        { categorySlot: 'Party Cups', product: cups, quantity: 1 },
        { categorySlot: 'Napkins', product: partyNapkins, quantity: 1 },
        ...(cutlery ? [{ categorySlot: 'Cutlery Combo', product: cutlery, quantity: 1 }] : []),
        ...(candles ? [{ categorySlot: 'Birthday Candles', product: candles, quantity: 1 }] : []),
      ];
      const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const totalMrp = items.reduce((sum, i) => sum + (i.product.mrp || i.product.price) * i.quantity, 0);
      bundles.push({
        id: 'bundle_birthday_party',
        name: 'Birthday Party Pack',
        tagline: 'Chilled Colas, Nachos, Chips, Paper Plates, Cups, Napkins & Candles',
        badge: 'ALL-IN-ONE CELEBRATION',
        items,
        totalPrice,
        totalMrp,
        savings: Math.max(0, totalMrp - totalPrice),
        isAvailable: true,
      });
    }

    // 5. Premium Party Pack: Premium Alcohol + Premium Tonic + Gourmet Nuts + Luxury Napkins
    const premAlcohol = getInStockProduct(p => p.categoryId === 'cat_premium' || (p.isAlcoholic && p.price >= 2000));
    const premMixer = getInStockProduct(p => p.categoryId === 'cat_mixers' && (p.brandId === 'b_fevertree' || p.brandId === 'b_schweppes'));
    const gourmetNuts = getInStockProduct(p => p.categoryId === 'cat_nuts' && p.price >= 200);
    const luxeNapkins = getInStockProduct(p => p.categoryId === 'cat_party_napkins');
    const opener = getInStockProduct(p => p.id === 'prod_steel_bottle_opener' || p.id === 'prod_wine_corkscrew_opener');

    if (premAlcohol && gourmetNuts && luxeNapkins) {
      const items = [
        { categorySlot: 'Reserve Spirit', product: premAlcohol, quantity: 1 },
        ...(premMixer ? [{ categorySlot: 'Artisanal Mixer', product: premMixer, quantity: 2 }] : []),
        { categorySlot: 'Gourmet Roasted Nuts', product: gourmetNuts, quantity: 1 },
        { categorySlot: 'Luxury Napkins', product: luxeNapkins, quantity: 1 },
        ...(opener ? [{ categorySlot: 'Deluxe Bar Tool', product: opener, quantity: 1 }] : []),
      ];
      const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
      const totalMrp = items.reduce((sum, i) => sum + (i.product.mrp || i.product.price) * i.quantity, 0);
      bundles.push({
        id: 'bundle_premium_party',
        name: 'Premium Party Pack',
        tagline: 'Imported Reserve Spirits, Fever-Tree Mixers, California Nuts & Deluxe Accessories',
        badge: 'TOP SHELF LUXURY',
        items,
        totalPrice,
        totalMrp,
        savings: Math.max(0, totalMrp - totalPrice),
        isAvailable: true,
      });
    }

    return bundles;
  },

  getSmartPairings(productId: string, storeId: string): Product[] {
    const targetProduct = db.findProductById(productId);
    if (!targetProduct) return [];

    const store = db.getStores().find(s => s.id === storeId);
    if (!store) return [];

    const getCandidates = (filterFn: (p: Product) => boolean, count: number = 2): Product[] => {
      return db
        .getProducts()
        .filter(p => {
          if (!p.isActive || p.id === productId) return false;
          if (p.availableStates?.length && !p.availableStates.includes(store.state)) return false;
          const stock = db.getStoreStock(storeId, p.id);
          return stock.available > 0 && filterFn(p);
        })
        .slice(0, count);
    };

    const pairings: Product[] = [];

    // Rules matching prompt section 28:
    // Whisky -> Soda, Water, Peanuts, Glasses
    if (targetProduct.categoryId === 'cat_whisky' || (targetProduct.isAlcoholic && targetProduct.name.toLowerCase().includes('whisky'))) {
      pairings.push(...getCandidates(p => p.categoryId === 'cat_mixers' && p.subcategory === 'Club Soda', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_water', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_nuts', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_glasses', 1));
    }
    // Beer -> Chips, Nachos, Peanuts, Glasses, Napkins
    else if (targetProduct.categoryId === 'cat_beer') {
      pairings.push(...getCandidates(p => p.categoryId === 'cat_snacks', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_nachos', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_nuts', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_glasses', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_napkins', 1));
    }
    // Vodka or Gin -> Tonic, Soda, Ice Bags, Glasses, Straws
    else if (targetProduct.categoryId === 'cat_vodka' || targetProduct.categoryId === 'cat_gin') {
      pairings.push(...getCandidates(p => p.categoryId === 'cat_mixers' && p.subcategory === 'Tonic Water', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_mixers' && p.subcategory === 'Club Soda', 1));
      pairings.push(...getCandidates(p => p.id === 'prod_ice_bags_5' || p.categoryId === 'cat_party', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_glasses', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_straws', 1));
    }
    // Plates -> Bowls, Glasses, Napkins, Cutlery
    else if (targetProduct.categoryId === 'cat_party_plates') {
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_bowls', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_glasses', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_napkins', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_cutlery', 1));
    }
    // Soft Drinks / Mixers -> Chips, Nachos, Glasses, Ice Bags
    else if (targetProduct.categoryId === 'cat_softdrinks' || targetProduct.categoryId === 'cat_mixers') {
      pairings.push(...getCandidates(p => p.categoryId === 'cat_snacks', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_nachos', 1));
      pairings.push(...getCandidates(p => p.categoryId === 'cat_party_glasses', 1));
    }
    // Fallback: popular party staples in store
    else {
      pairings.push(...getCandidates(p => p.categoryId === 'cat_snacks' || p.categoryId === 'cat_mixers' || p.categoryId.startsWith('cat_party'), 4));
    }

    // Deduplicate and attach store availability info
    const seen = new Set<string>();
    return pairings.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 6);
  }
};
