export abstract class BaseNormalizer<T = any, R = any> {
  normalize(value: T): R {
    throw new Error('Must be implemented by subclass');
  }
}

export type NormalizerFunction<T = any, R = any> = (value: T) => R;