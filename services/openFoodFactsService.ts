/**
 * openFoodFactsService.ts
 *
 * Thin wrapper around the Open Food Facts v2 product API.
 * No API key required. Looks up a product by barcode (EAN-13, UPC-A, UPC-E).
 *
 * Endpoint: https://world.openfoodfacts.org/api/v2/product/{barcode}.json
 * Response status: 1 = found, 0 = not found.
 * All macro values returned per 100g.
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

  const p = data.product;
  const n = p.nutriments ?? {};

  // Prefer explicit kcal field; fall back to kJ → kcal conversion
  let calories = n['energy-kcal_100g'] ?? 0;
  if (!calories && n['energy_100g']) {
    calories = Math.round(n['energy_100g'] / 4.184);
  }

  const protein = Math.round((n['proteins_100g'] ?? 0) * 10) / 10;
  const carbs   = Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10;
  const fats    = Math.round((n['fat_100g'] ?? 0) * 10) / 10;
  calories      = Math.round(calories);

  const name  = (p.product_name_en || p.product_name || 'Unknown Product').trim();
  const brand = p.brands ? p.brands.split(',')[0].trim() : undefined;
  const servingSize = p.serving_size?.trim() || '100g';

  return {
    found: true,
    item: {
      name,
      brand,
      servingSize,
      protein,
      carbs,
      fats,
      calories,
      barcode,
    },
  };
}
