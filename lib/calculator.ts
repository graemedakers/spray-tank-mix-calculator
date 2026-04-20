// ============================================================
// Core Calculation Engine — shared by Web and Mobile clients
// All logic lives here; both platforms import from this module.
// ============================================================

export type VolumeUnit = 'gallons' | 'liters';
export type AreaUnit = 'acres' | 'hectares';
export type RateUnit = 'oz/acre' | 'ml/acre' | 'lb/acre' | 'kg/acre' | 'oz/hectare' | 'ml/hectare' | 'lb/hectare' | 'kg/hectare';

export interface Ingredient {
  id: string;
  name: string;
  rate: number;       // numeric rate as entered by user
  rateUnit: RateUnit; // unit for that rate
}

export interface CalculatorInput {
  tankVolume: number;
  volumeUnit: VolumeUnit;
  areaSprayed: number;
  areaUnit: AreaUnit;
  ingredients: Ingredient[];
}

export interface IngredientResult {
  id: string;
  name: string;
  amount: number;
  displayUnit: string;
}

export interface CalculatorResult {
  ingredientAmounts: IngredientResult[];
  totalProductVolume: number; // in the selected volumeUnit
  waterVolume: number;        // in the selected volumeUnit
  totalVolume: number;        // should equal tankVolume
  isValid: boolean;
  error?: string;
}

// ---- Conversion helpers ----

const GALLONS_PER_LITER = 0.264172;
const LITERS_PER_GALLON = 3.78541;
const ACRES_PER_HECTARE = 2.47105;
const HECTARES_PER_ACRE = 0.404686;

/** Convert any rate to oz-per-acre for normalisation */
function rateToOzPerAcre(rate: number, unit: RateUnit): number {
  switch (unit) {
    case 'oz/acre':       return rate;
    case 'lb/acre':       return rate * 16;
    case 'oz/hectare':    return rate / ACRES_PER_HECTARE;
    case 'lb/hectare':    return rate * 16 / ACRES_PER_HECTARE;
    case 'ml/acre':       return rate * 0.033814;         // ml → fl oz
    case 'ml/hectare':    return rate * 0.033814 / ACRES_PER_HECTARE;
    case 'kg/acre':       return rate * 35.274;            // kg → oz
    case 'kg/hectare':    return rate * 35.274 / ACRES_PER_HECTARE;
    default:              return rate;
  }
}

/** oz total → display value + label for the selected volume system */
function ozToDisplay(oz: number, volumeUnit: VolumeUnit): { amount: number; displayUnit: string } {
  if (volumeUnit === 'liters') {
    // oz → ml (1 fl oz = 29.5735 ml)
    return { amount: parseFloat((oz * 29.5735).toFixed(2)), displayUnit: 'mL' };
  }
  // Keep as fl oz; show as gallons if large
  if (oz >= 128) {
    return { amount: parseFloat((oz / 128).toFixed(3)), displayUnit: 'gal' };
  }
  return { amount: parseFloat(oz.toFixed(2)), displayUnit: 'fl oz' };
}

// ---- Main calculation ----

export function calculate(input: CalculatorInput): CalculatorResult {
  const { tankVolume, volumeUnit, areaSprayed, areaUnit, ingredients } = input;

  if (!tankVolume || tankVolume <= 0 || !areaSprayed || areaSprayed <= 0) {
    return { ingredientAmounts: [], totalProductVolume: 0, waterVolume: 0, totalVolume: 0, isValid: false };
  }

  // Normalise area to acres
  const areaInAcres = areaUnit === 'hectares' ? areaSprayed * ACRES_PER_HECTARE : areaSprayed;

  // Normalise tank volume to gallons
  const tankInGallons = volumeUnit === 'liters' ? tankVolume * GALLONS_PER_LITER : tankVolume;

  let totalProductOz = 0;
  const ingredientAmounts: IngredientResult[] = [];

  for (const ing of ingredients) {
    if (!ing.rate || ing.rate <= 0) continue;

    // Total oz of this product for the whole area
    const ozPerAcre = rateToOzPerAcre(ing.rate, ing.rateUnit);
    const totalOz = ozPerAcre * areaInAcres;
    totalProductOz += totalOz;

    const { amount, displayUnit } = ozToDisplay(totalOz, volumeUnit);
    ingredientAmounts.push({ id: ing.id, name: ing.name, amount, displayUnit });
  }

  // Convert total product oz to the user's volume unit for water calculation
  const totalProductGallons = totalProductOz / 128; // 128 fl oz per gallon
  const totalProductLiters  = totalProductGallons * LITERS_PER_GALLON;

  const totalProductInUserUnit = volumeUnit === 'liters' ? totalProductLiters : totalProductGallons;
  const waterVolume = Math.max(0, parseFloat((tankVolume - totalProductInUserUnit).toFixed(2)));

  if (totalProductInUserUnit > tankVolume) {
    return {
      ingredientAmounts,
      totalProductVolume: parseFloat(totalProductInUserUnit.toFixed(3)),
      waterVolume: 0,
      totalVolume: tankVolume,
      isValid: false,
      error: 'Product volumes exceed tank capacity. Increase tank size or reduce rates.',
    };
  }

  return {
    ingredientAmounts,
    totalProductVolume: parseFloat(totalProductInUserUnit.toFixed(3)),
    waterVolume,
    totalVolume: tankVolume,
    isValid: true,
  };
}
