import { useId, useState } from 'react';
import { nutritionNumber } from '../src/food';
export class FoodFieldError extends Error {
  constructor(public field: string, message: string) { super(message); }
}
export function foodNumber(value: string, field: string, label: string): number {
  try { return nutritionNumber(value, label); } catch (e) { throw new FoodFieldError(field, (e as Error).message); }
}
export function useFoodValidation(formId: string) {
  const prefix = useId();
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const attributes = (field: string) => ({ 'data-field': field, 'aria-invalid': error?.field === field || undefined, 'aria-describedby': error?.field === field ? `${prefix}-${field}` : undefined });
  const fail = (exception: unknown) => {
    const field = exception instanceof FoodFieldError ? exception.field : '';
    setError({ field, message: (exception as Error).message });
    requestAnimationFrame(() => {
      const form = document.getElementById(formId);
      const target = field ? form?.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`) : null;
      if (target) {
        let parent = target.parentElement;
        while (parent && parent !== form) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
        target.focus(); target.scrollIntoView({ block: 'nearest' });
      }
    });
  };
  return { error, attributes, fail, clear: () => setError(null), errorId: (field: string) => `${prefix}-${field}` };
}
