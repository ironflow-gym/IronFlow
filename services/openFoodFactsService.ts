/**
 * openFoodFactsService.ts
 *
 * Thin wrapper around the Open Food Facts v2 product API.
 * No API key required. Looks up a product by barcode (EAN-13, UPC-A, UPC-E).
 *
 * Endpoint: https://world.openfoodfacts.org/api/v2/product/{barcode}.json
 * Response status: 1 = found, 0 = not found.
 * Macro values are per 100g or 100ml; label basis is confirmed by the user.
 */

import { FoodItem } from '../types';

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  'energy_100g'?: number;          // kJ fallback
  'proteins_100g'?: number;
  'carbohydrates_100g'?: number;
  'fat_100g'?: number;
  'fiber_100g'?: number;
}

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OFFNutriments;
}

interface OFFResponse {
  status: number;    // 1 = found, 0 = not found
  product?: OFFProduct;
}

export interface OFFLookupResult {
  found: true;
  item: Omit<FoodItem, 'id' | 'lastUsed'> & { barcode: string };
}

export interface OFFNotFound {
  found: false;
}

export type OFFResult = OFFLookupResult | OFFNotFound;

/**
 * Look up a product barcode against Open Food Facts.
 * Returns a partial FoodItem (no id/lastUsed) on success, or { found: false }.
 * Throws on network error so callers can surface a connection message.
 */
export async function lookupBarcode(barcode: string): Promise<OFFResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'IronFlow-PWA/2.12 (contact@ironflow.app)' },
  });

  if (!response.ok) {
    throw new Error(`Open Food Facts returned HTTP ${response.status}`);
  }

  const data: OFFResponse = await response.json();

  if (data.status !== 1 || !data.product) {
    return { found: false };
  }

  return { found: true, item: { ...readFoodProduct(data.product), barcode } };
}

/** Preserve unknown nutrients and do not infer gram/millilitre units from OFF's field names. */
export function readFoodProduct(p: OFFProduct): Omit<FoodItem, 'id' | 'lastUsed'> {
  const n = p.nutriments ?? {};

  // An absent/invalid nutrient is unknown, never a confirmed zero.
  const value = (raw: unknown): number | undefined => typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : undefined;
  const kcal = value(n['energy-kcal_100g']);
  const kj = value(n['energy_100g']);
  const raw = { calories: kcal ?? (kj === undefined ? undefined : kj / 4.184), protein: value(n.proteins_100g), carbs: value(n.carbohydrates_100g), fats: value(n.fat_100g) };
  const missingNutrients = (Object.keys(raw) as (keyof typeof raw)[]).filter(key => raw[key] === undefined);
  const rounded = (key: keyof typeof raw) => Math.round((raw[key] ?? 0) * 100) / 100;
  const calories = rounded('calories'), protein = rounded('protein'), carbs = rounded('carbs'), fats = rounded('fats');

  const name  = (p.product_name_en || p.product_name || 'Unknown Product').trim();
  const brand = p.brands ? p.brands.split(',')[0].trim() : undefined;
  const servingSize = p.serving_size?.trim() || '';

  return {
      name,
      brand,
      // OFF's _100g fields can describe 100g or 100ml. Confirm label units in the editor.
      nutritionSource: 'barcode',
      missingNutrients,
      servingSize,
      protein,
      carbs,
      fats,
      calories,
  };
}
