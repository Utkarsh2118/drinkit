import { Product } from '../types.ts';
import { ALCOHOL_PRODUCTS } from './products_alcohol.ts';
import { DRINKS_PRODUCTS } from './products_drinks.ts';
import { PARTY_PRODUCTS } from './products_party.ts';
import { EXTRA_PRODUCTS } from './products_extra.ts';

export const SEED_PRODUCTS: Product[] = [
  ...ALCOHOL_PRODUCTS,
  ...DRINKS_PRODUCTS,
  ...PARTY_PRODUCTS,
  ...EXTRA_PRODUCTS,
];
