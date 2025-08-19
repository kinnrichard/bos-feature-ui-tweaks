export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string[]>;
}

export interface ValidationContext {
  modelClass?: string;
  scope?: Record<string, any>;
  id?: string;
  [key: string]: any;
}

export abstract class BaseValidator<T = any> {
  validate(value: T, context?: ValidationContext): ValidationResult | Promise<ValidationResult> {
    throw new Error('Must be implemented by subclass');
  }

  protected validationResult(valid: boolean, errors?: Record<string, string[]>): ValidationResult {
    return { valid, errors: errors || {} };
  }
}

export type ValidatorFunction<T = any> = (
  value: T, 
  context?: ValidationContext
) => ValidationResult | Promise<ValidationResult>;