export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export type CeelineResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

export function ok<T>(value: T): CeelineResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(issues: ValidationIssue[] | ValidationIssue): CeelineResult<T> {
  return { ok: false, issues: Array.isArray(issues) ? issues : [issues] };
}
