import type { JoshOptions } from '../types/JoshOptions';
import { JoshError } from './JoshError';
import type { JoshProvider } from './JoshProvider';
import { get, merge } from 'lodash';
import type { ExportJSON } from '../types/ExportJSON';
import type { Awaited } from '../types/Awaited';

/**
 * Josh, a Javascript Object Storage Helper.
 *
 * @example
 * ```javascript
 * // With Javascript CJS.
 * const { Josh } = require('josh');
 * const { SQLiteProvider } = require('@josh-providers/sqlite');
 *
 * new Josh({
 *   name: 'example-cjs',
 *   provider: SQLiteProvider
 * });
 *
 * // With Javascript ESM.
 * import { Josh } from '@josh';
 * import { SQLiteProvider } from '@josh-providers/sqlite';
 *
 * new Josh({
 *   name: 'example-cjs',
 *   provider: SQLiteProvider
 * })
 * ```
 */
export class Josh<T = unknown, K = T> {
  /**
   * The name of this [[Josh]] instance.
   */
  public name: string;

  /**
   * Symbol for all.
   * @example
   * ```javascript
   * Josh.getMany(Josh.all);
   * ```
   */
  public all = Symbol('_all');
  public off = Symbol('_off');

  private provider: JoshProvider<K>;

  private serializer: (data: T | unknown, key?: string, path?: string) => Awaited<K>;
  private deserializer: (data: K | unknown, key?: string, path?: string) => Awaited<T>;

  private autoEnsure?: K;

  private isDestroyed = false;

  private ready!: (value?: unknown) => void;
  private get defer() {
    return new Promise((resolve) => (this.ready = resolve));
  }

  /**
   *
   * @param options The options for this [[Josh]] instance.
   */
  public constructor(options: JoshOptions<T, K>) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { provider: Provider, name } = options;

    if (!Provider) throw new JoshError('Provider option not found.', 'JoshOptionsError');
    if (!name) throw new JoshError('Name option not found', 'JoshOptionsError');

    // @ts-expect-error 2511
    const initializedProvider = new Provider({ name, options: options.providerOptions });
    if (initializedProvider.constructor.name !== 'JoshProvider')
      throw new JoshError(`JoshProvider ivalid. ${initializedProvider.constructor.name} is not a valid provider.`);

    this.provider = initializedProvider;
    this.name = name;

    this.serializer = options.serializer ?? ((data) => (data as unknown) as K);
    this.deserializer = options.deserializer ?? ((data) => (data as unknown) as T);

    this.autoEnsure = options.autoEnsure;

    void this.provider.init().then(() => this.ready());
  }

  /**
   * Checks whether or not the provider is ready or not.
   * @example
   * ```javascript
   *
   * ```
   */
  public async readyCheck() {
    await this.defer;
    if (this.isDestroyed) throw new JoshError('This Josh has been destroyed', 'JoshDestroyError');
  }

  /**
   * Verifies whether a key, or a specific property of an object, exists.
   * @param keyOrPath Either a key, or full path of the value you want to get.
   */
  public async has(keyOrPath: string) {
    await this.readyCheck();

    try {
      const [key, path] = this.getKeyAndPath(keyOrPath);
      return this.provider.has(key, path);
    } catch (error) {
      console.log(`Error on "${keyOrPath}": ${error}`);
      return false;
    }
  }

  /**
   * Retrieves (fetches) a value from the provider.
   * @param keyOrPath Either a key, or full path of the value you want to get.
   */
  public async get<V = T>(keyOrPath: string): Promise<V | null> {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);
    const hasKey = await this.has(keyOrPath);

    const value = hasKey ? await this.provider.get(key, path) : this.autoEnsure ?? null;
    const deserialized = value ? await this.deserializer(value, key, path) : null;

    return deserialized ? (path.length ? get(deserialized, path) : value) : null;
  }

  /**
   * Retrieves (fetches) many values from the provider.
   * @param keys Either an array of keys, or the [[Josh.all]] symbol.
   */
  public async getMany(keys: string[] | symbol) {
    await this.readyCheck();

    const data = keys === this.all ? await this.provider.getAll() : typeof keys === 'symbol' ? {} : await this.provider.getMany(keys);
    const deserialized: Record<string, T> = {};

    for (const key of Object.keys(data)) deserialized[key] = await this.deserializer(data[key], key, '');

    return deserialized;
  }

  /**
   * Returns one or more random values from the provider.
   * @param count The number of random values to get. Defaults to `1`.
   */
  public async random(count = 1) {
    await this.readyCheck();

    return this.provider.random(count);
  }

  /**
   * Returns one or more random keys from the provider.
   * @param count The number of random values to get. Defaults to `1`.
   */
  public async randomKey(count = 1) {
    await this.readyCheck();

    return this.provider.randomKey(count);
  }

  /**
   * Retrieves all keys from the provider.
   */
  public get keys() {
    return this.readyCheck().then(() => this.provider.keys());
  }

  /**
   * Retrieves all values from the provider.
   */
  public get values() {
    return this.readyCheck().then(() => this.provider.values());
  }

  /**
   * The count of rows from the provider.
   */
  public get size() {
    return this.readyCheck().then(() => this.provider.count());
  }

  /**
   * Store a value in the provider.
   * @param keyOrPath Either a key, or a full path, where you want to store the value.
   * @param value The value to store for the key, or in the path, if specified.
   */
  public async set<V = T>(keyOrPath: string, value: V): Promise<Josh> {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);

    await this.provider.set(key, path, await this.serializer(value, key, path));
    return this;
  }

  /**
   * Store many values in the provider. This does not support paths, nor [[Josh.autoId]]
   * @param data The data to store. This is an object of key/value pairs.
   * @param overwrite Whether to overwrite existing keys.
   */
  public async setMany(data: Record<string, T>, overwrite = false): Promise<Josh> {
    await this.readyCheck();

    const serialized: Record<string, K> = {};

    for (const [key, value] of Object.entries(data)) serialized[key] = await this.serializer(value, key, '');

    await this.provider.setMany(serialized, overwrite);
    return this;
  }

  /**
   * Update an existing object in the provider with modified values. Similar to [[Josh.set]] except this does not overwrite the entire object.
   * Instead, the data is merged with the existing object.
   * @param keyOrPath Either a key, or full path, of the value you want to update.
   * @param valueOrFunction Either an object, or a function.
   */
  public async update<V = T>(keyOrPath: string, valueOrFunction: ((previousValue: V) => Awaited<Partial<V>>) | Partial<V>): Promise<Josh> {
    await this.readyCheck();

    const previousValue = await this.get<V>(keyOrPath);

    if (!previousValue) throw new JoshError('Previous value not found.');

    const value = typeof valueOrFunction === 'function' ? await valueOrFunction(previousValue) : valueOrFunction;

    await this.set(keyOrPath, merge(previousValue, value));
    return this;
  }

  /**
   * Ensures that the key exist, if not uses the [[Josh.set]] method and returns the `defaultValue`, else uses and returns the value from [[Josh.get]].
   * @param keyOrPath Either a key, or full path, of the value you want to ensure.
   * @param defaultValue The value you want to save in the provider if the key does not exist and returns it.
   */
  public async ensure<V = T>(keyOrPath: string, defaultValue: V) {
    await this.readyCheck();

    const hasKey = await this.has(keyOrPath);

    if (!hasKey) {
      await this.set<V>(keyOrPath, defaultValue);
      return defaultValue;
    }

    return this.get<V>(keyOrPath);
  }

  /**
   * Delete a key, the property at a specific path, or clear the provider.
   * @param keyOrPath Either a key or full path. An array of keys or the [[Josh.all]] symbol.
   */
  public async delete(keyOrPath: string | string[] | symbol): Promise<Josh> {
    await this.readyCheck();

    if (Array.isArray(keyOrPath)) {
      await this.provider.deleteMany(keyOrPath);
    } else if (keyOrPath === this.all) {
      await this.provider.clear();
    } else {
      const [key, path] = this.getKeyAndPath(keyOrPath as string);
      await this.provider.delete(key, path);
    }

    return this;
  }

  /**
   * Push a new value to an array.
   * @param keyOrPath Either a key, or full path, where you want to push the value to.
   * @param value The value to push to the array.
   * @param allowDupes Whether to allow duplicate values to be added. Note that if your pushing objects or arrays, duplicates can occur no matter what, as detecting duplicate arrays or objects are CPU intensive.
   */
  public async push<V = T>(keyOrPath: string, value: V, allowDupes = true): Promise<Josh> {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);
    await this.provider.push<V>(key, path, ((await this.serializer(value, key, path)) as unknown) as V, allowDupes);

    return this;
  }

  /**
   * Remove a value from an array.
   * @param keyOrPath Either a key, or full path, where you want to remove the value from.
   * @param valueOrFn Either a value, or a function to match a value stored in the array.
   */
  public async remove<V = T>(keyOrPath: string, valueOrFn: ((value: V) => Awaited<boolean>) | V): Promise<Josh> {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);
    await this.provider.remove(key, path, valueOrFn);

    return this;
  }

  /**
   * Increments (adds 1 to the number) the stored value in the provider.
   * @param keyOrPath Either a key, or full path, to the value you want to increment. The value must be a number.
   */
  public async inc(keyOrPath: string) {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);
    await this.provider.inc(key, path);

    return this;
  }

  /**
   * Decrements (removes 1 from the number) the stored value in the provider.
   * @param keyOrPath Either a key, or full path, to the value you want to decrement. The value must be a number.
   */
  public async dec(keyOrPath: string) {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);
    await this.provider.dec(key, path);

    return this;
  }

  /**
   * Finds a value with a path and the value to match.
   * @param path The path to match the value to.
   * @param value The value to match with the path.
   */
  public async find(path: string, value: string | number | boolean): Promise<T>;
  /**
   * Finds a value with a function.
   * @param fn The function to find a value with. Value passed is relative to the `path` paramter, if none, passes full value.
   * @param path Optional. The path of the value to pass to the function.
   */
  public async find<V = T>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<T>;
  public async find<V = T>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<T> {
    await this.readyCheck();

    if (typeof pathOrFn === 'function' && typeof predicate !== 'string') throw new JoshError('Predicate is not a string.');
    if (typeof pathOrFn !== 'function' && !['string', 'number', 'boolean'].includes(typeof predicate))
      throw new JoshError('Predicate is not a string, number, or boolean');

    return this.deserializer(
      typeof pathOrFn === 'function'
        ? await this.provider.findByFunction(pathOrFn, predicate as string | undefined)
        : await this.provider.findByValue(pathOrFn, predicate as string | number | boolean)
    );
  }

  /**
   * Filters values with a path and the value to match.
   * @param path The path to match the value to.
   * @param value The value to match with the path.
   */
  public async filter(path: string, value: string | number | boolean): Promise<T[]>;
  /**
   * Filters values with a function.
   * @param fn The function to filter values with. Value passed is relative to the `path` paramter, if none, passes full value.
   * @param path Optional. The path of the value to pass to the function.
   */
  public async filter<V = T>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<T[]>;
  public async filter<V = T>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<T[]> {
    await this.readyCheck();

    if (typeof pathOrFn === 'function' && typeof predicate !== 'string') throw new JoshError('Predicate is not a string.');
    if (typeof pathOrFn !== 'function' && typeof !['string', 'number', 'boolean'].includes(typeof predicate))
      throw new JoshError('Predicate is not a string, number or boolean.');

    return Promise.all(
      (typeof pathOrFn === 'function'
        ? await this.provider.filterByFunction(pathOrFn, predicate as string | undefined)
        : await this.provider.filterByValue(pathOrFn, predicate as string | number | boolean)
      ).map(async (value) => this.deserializer(value))
    );
  }

  /**
   * Maps over data for each value in the provider.
   * @param pathOrFn Either a path, or a function.
   */
  public async map<V = T>(pathOrFn: string | ((value: T) => Awaited<V>)): Promise<V[]> {
    await this.readyCheck();

    return typeof pathOrFn === 'function' ? this.provider.mapByFunction(pathOrFn as (value: unknown) => V) : this.provider.mapByPath(pathOrFn);
  }

  /**
   * Performs like [Array.includes()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes).
   * @param keyOrPath Either a key, or full path, to the array you want to check for the value.
   * @param value
   */
  public async includes<V = T>(keyOrPath: string, value: V) {
    await this.readyCheck();
    const [key, path] = this.getKeyAndPath(keyOrPath);
    return this.provider.includes(key, path, value);
  }

  /**
   * Performs like [[Josh.find]] except returns a boolean.
   * @param path The path to match the value to.
   * @param value The value to match with the path.
   */
  public async some(path: string, value: string | number | boolean): Promise<boolean>;
  /**
   * Performs like [[Josh.find]] except returns a boolean.
   * @param fn The function to check a value with. Value passed is relative to the `path` parameter, if none, passes full value.
   * @param path Optional. The path of the value to pass to the function.
   */
  public async some<V = T>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<boolean>;
  public async some<V = T>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<boolean> {
    await this.readyCheck();

    if (typeof pathOrFn === 'function' && typeof predicate !== 'string') throw new JoshError('Predicate is not a string.');
    if (typeof pathOrFn !== 'function' && !['string', 'number', 'boolean'].includes(typeof predicate))
      throw new JoshError('Predicate is not a string, number, or boolean.');

    return typeof pathOrFn === 'function'
      ? this.provider.someByFunction(pathOrFn, predicate as string | undefined)
      : this.provider.someByValue(pathOrFn, predicate as string | number | boolean);
  }

  /**
   * Identical to [[Josh.some]], except all must match.
   * @param path The path to match the value to.
   * @param value The value to match with the path.
   */
  public async every(path: string, value: string | number | boolean): Promise<boolean>;
  /**
   * Identical to [[Josh.some]]
   * @param fn The function to check a value with. Value passed is relative to the `path` parameter, if none, passes full value.
   * @param path Optional. The path of the value to pass to the function.
   */
  public async every<V = T>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<boolean>;
  public async every<V = T>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<boolean> {
    await this.readyCheck();

    if (typeof pathOrFn === 'function' && typeof predicate !== 'string') throw new JoshError('Predicate is not a string.');
    if (typeof pathOrFn !== 'function' && !['string', 'number', 'boolean'].includes(typeof predicate))
      throw new JoshError('Predicate is not a string, number, or boolean');

    return typeof pathOrFn === 'function'
      ? this.provider.everyByFunction(pathOrFn, predicate as string | undefined)
      : this.provider.everyByValue(pathOrFn, predicate as string | number | boolean);
  }

  /**
   * Executes a mathematical operation on a value and saves the result in the provider.
   * @param keyOrPath Either a key, or full path, to the value you want to execute math on. Value must be a number.
   * @param operation Which mathematical operation to execute. Supports most operations: `=`, `-`, `*`, `/`, `%`, `^`, and english spelling of those operations.
   * @param operand The right operand of the math operation.
   */
  public async math(keyOrPath: string, operation: string, operand: number) {
    await this.readyCheck();

    const [key, path] = this.getKeyAndPath(keyOrPath);

    await this.provider.math(key, path, operation, operand);
  }

  /**
   * Get an automatic id for insertion of a new value.
   */
  public async autoId() {
    await this.readyCheck();
    return this.provider.autoId();
  }

  /**
   * Import an existing json export from [[Josh]] or Enmap. This data must have been exported from [[Josh]] or Enmap, and must be from a version that's equivalent or lower than your current version.
   * @param data The data to import to this [[Josh]] instance. Must contain all the required fields provided by [[Josh.export]].
   * @param overwrite Whether to overwrite existing key values with the imported data. Defaults to `false`.
   * @param clear Whether to clear the [[Josh]] of all data before importing.
   */
  public async import(data: string, overwrite = true, clear = false) {
    await this.readyCheck();

    if (clear) await this.delete(this.all);

    const parsed = JSON.parse(data) as ExportJSON<K>;
    const serialized: Record<string, K> = {};

    for (const [key, value] of Object.entries(parsed)) serialized[key] = await this.serializer(value, key);

    await this.provider.setMany(parsed.keys, overwrite);
    return this;
  }

  /**
   * Exports all data from the provider in JSON format. Can be used as import data for both [[Josh]] and Enmap.
   * WARNING: This currently requires loading all data from the provider into memory to write to JSON and might fail on large datasets.
   */
  public async export() {
    await this.readyCheck();

    const data = await this.provider.getAll();
    const deserialized: Record<string, T> = {};

    for (const [key, value] of Object.entries(data)) deserialized[key] = await this.deserializer(value, key);

    return JSON.stringify(
      {
        name: this.name,
        exportTimestamp: Date.now(),
        keys: data,
      } as ExportJSON<K>,
      null,
      2
    );
  }

  /**
   * Internal method of splitting key and path strings.
   * @param keyOrPath The key and path to split.
   */
  private getKeyAndPath(keyOrPath: string): [string, string] {
    if (keyOrPath) throw new JoshError('KeyOrPath is null.');
    const [key, ...path] = keyOrPath.split('.');
    return [key, path.join('.')];
  }

  /**
   * Initializes multiple [[Josh]] instances easily.
   * @param names An array of name strings. Each element will create a separate [[Josh]] instance with that name.
   * @param options Options to pass to each [[Josh]] instance, excluding it's name.
   */
  public static multi(names: string[], options: JoshOptions) {
    if (!names.length) throw new JoshError('Names array not found or is too short.');

    const instances: Record<string, Josh> = {};

    for (const name of names) instances[name] = new Josh({ name, ...options });

    return instances;
  }
}
