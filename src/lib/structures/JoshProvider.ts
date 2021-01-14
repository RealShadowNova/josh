import type { Awaited } from '../types/Awaited';
import type { JoshProviderOptions } from '../types/JoshProviderOptions';
import type { Josh } from './Josh';

export abstract class JoshProvider<K = unknown> {
  public name: string;

  public instance: Josh<unknown, K>;

  public options: Record<string, unknown>;

  public constructor({ name, options, instance }: JoshProviderOptions<K>) {
    this.name = name;
    this.options = options;
    this.instance = instance;
  }

  public abstract init(): Promise<void>;

  public abstract has(key: string, path: string): Promise<boolean>;

  public abstract get(key: string, path: string): Promise<K | null>;
  public abstract getAll(): Promise<Record<string, K>>;
  public abstract getMany(keys: string[]): Promise<Record<string, K>>;

  public abstract random(count: number): Promise<Record<string, K>>;
  public abstract randomKey(count: number): Promise<string[]>;

  public abstract keys(): Promise<string[]>;
  public abstract values(): Promise<K[]>;
  public abstract count(): Promise<number>;

  public abstract set(key: string, path: string, value: K): Promise<JoshProvider>;
  public abstract setMany(data: Record<string, Partial<K>>, overwrite: boolean): Promise<JoshProvider>;

  public abstract delete(key: string, path: string): Promise<JoshProvider>;
  public abstract clear(): Promise<JoshProvider>;
  public abstract deleteMany(keysOrPaths: string[]): Promise<JoshProvider>;

  public abstract push<V = K>(key: string, path: string, value: V, allowDupes: boolean): Promise<JoshProvider>;
  public abstract remove<V = K>(key: string, path: string, valueOrFunction: ((value: V) => Awaited<boolean>) | V): Promise<JoshProvider>;

  public abstract inc(key: string, path: string): Promise<JoshProvider>;
  public abstract dec(key: string, path: string): Promise<JoshProvider>;

  public abstract findByFunction<V = K>(fn: ((value: V) => Awaited<boolean>) | string, path?: string): Promise<K | null>;
  public abstract findByValue(path: string, value: string | number | boolean): Promise<K | null>;

  public abstract filterByFunction<V = K>(fn: ((value: V) => Awaited<boolean>) | string, path?: string): Promise<K[]>;
  public abstract filterByValue(path: string, value: string | number | boolean): Promise<K[]>;

  public abstract mapByFunction<V = K>(fn: (value: unknown) => Awaited<V>): Promise<V[]>;
  public abstract mapByPath<V = K>(path: string): Promise<V[]>;

  public abstract includes<V = K>(key: string, path: string, value: V): Promise<boolean>;

  public abstract someByFunction<V = K>(fn: ((value: V) => Awaited<boolean>) | string, path?: string): Promise<boolean>;
  public abstract someByValue(path: string, value: string | number | boolean): Promise<boolean>;

  public abstract everyByFunction<V = K>(fn: ((value: V) => Awaited<boolean>) | string, path?: string): Promise<boolean>;
  public abstract everyByValue(path: string, value: string | number | boolean): Promise<boolean>;

  public abstract math(key: string, path: string, operation: string, operand: number): Promise<JoshProvider>;

  public abstract autoId(): Promise<number>;

  public abstract close(): Promise<void>;
  public abstract destroy(): Promise<void>;

  public abstract parseData(data: K): Promise<K>;
}
