/** Validate every structured model response before any caller can use it. */
export class AIValidationError extends Error {
  constructor(path: string, problem: string) {
    super(`AI response rejected at ${path}: ${problem}. No generated changes were applied.`);
    this.name = 'AIValidationError';
  }
}
interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  nullable?: boolean;
}
const fail = (path: string, message: string): never => { throw new AIValidationError(path, message); };
const ranges: Record<string, [number, number, boolean?]> = {
  suggestedSets: [1, 20, true], warmupCount: [0, 10, true], suggestedReps: [1, 36000, true],
  suggestedWeight: [0, 10000], restSeconds: [0, 3600, true], confidence: [0, 1],
  weight: [1, 3000], calories: [0, 100000], protein: [0, 10000], carbs: [0, 10000], fats: [0, 10000],
  targetProteinRatio: [0.1, 5], targetMultiplier: [0.1, 5], bodyFat: [0, 100],
};

export function parseAIResponse(text: string | undefined, schema: unknown): unknown {
  if (!text?.trim() || text.length > 2_000_000) return fail('response', 'missing or oversized JSON');
  let value: unknown;
  try { value = JSON.parse(text); } catch { return fail('response', 'invalid JSON'); }
  function validate(input: unknown, rule: Schema, path: string, field = ''): unknown {
    if (input === null && rule.nullable) return null;
    if (rule.enum && !rule.enum.includes(input)) return fail(path, 'unsupported value');
    switch (String(rule.type).toUpperCase()) {
      case 'OBJECT': {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(path, 'expected an object');
        const object = input as Record<string, unknown>;
        for (const key of rule.required ?? []) if (!Object.hasOwn(object, key)) return fail(`${path}.${key}`, 'required field missing');
        // Keep only schema-declared fields. Model-supplied IDs and settings must
        // never overwrite a saved record through an object spread.
        const result: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(rule.properties ?? {})) {
          if (Object.hasOwn(object, key)) result[key] = validate(object[key], child, `${path}.${key}`, key);
        }
        if (rule.properties?.logs && Array.isArray(result.logs) && result.logs.length === 0 && !result.updatedProfile) return fail(path, 'no food or profile update returned');
        if (rule.properties?.bodyFat && rule.properties?.weight && !Object.keys(result).some(key => key !== 'date')) return fail(path, 'no measurements returned');
        if (field === 'updatedProfile' && !Object.keys(result).length) return fail(path, 'empty profile update');
        return result;
      }
      case 'ARRAY': {
        if (!Array.isArray(input) || input.length > 500) return fail(path, 'expected a bounded array');
        if (['exercises', 'templates'].includes(field) && !input.length) return fail(path, 'empty workout or programme');
        if (field === 'exercises' && input.length > 50) return fail(path, 'too many exercises');
        if (field === 'templates' && input.length > 28) return fail(path, 'too many sessions');
        return input.map((item, index) => validate(item, rule.items ?? {}, `${path}[${index}]`, field === 'exercises' ? 'exercise' : field));
      }
      case 'STRING': {
        if (typeof input !== 'string' || input.length > 20000) return fail(path, 'expected bounded text');
        if (['name', 'category', 'targetReps', 'date', 'servingSize', 'title', 'importedName', 'suggestedStandardName'].includes(field) && !input.trim()) return fail(path, 'empty required text');
        if (field === 'targetReps') {
          const range = /^(\d+)(?:\s*(?:-|–|to)\s*(\d+))?(?:\s*(?:reps?|s|secs?|seconds?|mins?|minutes?))?(?:\s+per\s+(?:side|hand|leg|arm))?$/i.exec(input.trim());
          if (!/^(?:AMRAP|to failure|until failure|maximum reps)$/i.test(input.trim()) && (!range || Number(range[1]) < 1 || Number(range[1]) > 36000 || (range[2] && (Number(range[2]) < Number(range[1]) || Number(range[2]) > 36000)))) return fail(path, 'invalid rep or time target');
        }
        if (field === 'date') {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
          if (!match) return fail(path, 'expected a calendar date');
          const [, y, m, d] = match.map(Number);
          const date = new Date(Date.UTC(y, m - 1, d));
          if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return fail(path, 'invalid calendar date');
        }
        return input;
      }
      case 'NUMBER': case 'INTEGER': {
        if (typeof input !== 'number' || !Number.isFinite(input)) return fail(path, 'expected a finite number');
        const range = ranges[field];
        if (range && (input < range[0] || input > range[1] || (range[2] && !Number.isInteger(input)))) return fail(path, 'number outside supported range');
        if (['shoulders', 'chest', 'abs', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'calves', 'upperBack', 'lowerBack', 'lats', 'glutes'].includes(field) && rule && path.startsWith('response.') && !path.includes('[') && (input < 0 || input > 100)) return fail(path, 'score outside 0–100');
        if (input < 0 || input > 1_000_000) return fail(path, 'number outside supported range');
        if (String(rule.type).toUpperCase() === 'INTEGER' && !Number.isInteger(input)) return fail(path, 'expected an integer');
        return input;
      }
      case 'BOOLEAN':
        if (typeof input !== 'boolean') return fail(path, 'expected true or false');
        return input;
      default: return fail(path, 'unsupported response schema');
    }
  }
  return validate(value, schema as Schema, 'response');
}
