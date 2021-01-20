import { JoshError } from './JoshError';
import { JoshProvider } from './JoshProvider';
import { get, merge } from 'lodash';
import type { Awaited } from '../types/Awaited';
import { MapProvider } from './MapProvider';

export interface JoshOptions<D = unknown, S = D> {
	provider?: typeof JoshProvider;
	providerOptions?: Record<string, unknown>;
	name?: string;
	ensureProps?: boolean;
	autoEnsure?: S;
	serializer?: (data: D, key?: string, path?: string) => Awaited<S>;
	deserializer?: (data: S, key?: string, path?: string) => Awaited<D>;
}

export interface ExportJSON<K = unknown> {
	name: string;
	exportTimestamp: number;
	keys: Record<string, K>;
}

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
export class Josh<D = unknown, S = D> {
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

	public serializer: (data: D, key?: string, path?: string) => Awaited<S>;
	public deserializer: (data: S, key?: string, path?: string) => Awaited<D>;

	public autoEnsure?: S;

	private provider: JoshProvider<D, S>;

	private isDestroyed = false;

	private ready!: (value?: unknown) => void;
	private defer = new Promise((resolve) => (this.ready = resolve));

	/**
	 *
	 * @param options The options for this [[Josh]] instance.
	 */
	public constructor({ name, provider, ...options }: JoshOptions<D, S>) {
		if (!name) throw new JoshError('Name option not found', 'JoshOptionsError');

		const Provider = provider ?? Josh.defaultProvider;

		if (!JoshProvider.isPrototypeOf(Provider)) throw new JoshError('Provider class must extend JoshProvider');

		// @ts-expect-error 2511
		const initializedProvider = new Provider({ name, instance: this, options: options.providerOptions });

		this.provider = initializedProvider;
		this.name = name;

		this.serializer = options.serializer ?? ((data) => (data as unknown) as S);
		this.deserializer = options.deserializer ?? ((data) => (data as unknown) as D);

		this.autoEnsure = options.autoEnsure;

		void this.provider.init().then(() => this.ready());
	}

	public setDeserializer(deserializer: (data: S, key?: string, path?: string) => Awaited<D>): Josh<D, S> {
		this.deserializer = deserializer;
		return this;
	}

	public setSerializer(serializer: (data: D, key?: string, path?: string) => Awaited<S>): Josh<D, S> {
		this.serializer = serializer;
		return this;
	}

	public setAutoEnsure(autoEnsure: S): Josh<D, S> {
		this.autoEnsure = autoEnsure;
		return this;
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
			const [key, path] = this.getSeyAndPath(keyOrPath);
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
	public async get<V = D>(keyOrPath: string): Promise<V | null> {
		await this.readyCheck();

		const [key, path] = this.getSeyAndPath(keyOrPath);
		const hasSey = await this.has(keyOrPath);

		const value = hasSey ? await this.provider.get(key, path) : this.autoEnsure ?? null;
		const deserialized = value ? await this.deserializer(value, key, path) : null;

		return deserialized ? (path.length ? get(deserialized, path) ?? null : deserialized) : null;
	}

	/**
	 * Retrieves (fetches) many values from the provider.
	 * @param keys Either an array of keys, or the [[Josh.all]] symbol.
	 */
	public async getMany(keys: string[] | symbol) {
		await this.readyCheck();

		const data = keys === this.all ? await this.provider.getAll() : typeof keys === 'symbol' ? {} : await this.provider.getMany(keys);
		const deserialized: Record<string, D> = {};

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
	public async randomSey(count = 1) {
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
		return this.readyCheck().then(async () => Promise.all((await this.provider.values()).map((user) => this.deserializer(user))));
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
	public async set<V = D>(keyOrPath: string, value: V): Promise<Josh<D, S>> {
		await this.readyCheck();

		const [key, path] = this.getSeyAndPath(keyOrPath);

		await this.provider.set(key, path, await this.serializer(value as any, key, path));

		return this;
	}

	/**
	 * Store many values in the provider. This does not support paths, nor [[Josh.autoId]]
	 * @param data The data to store. This is an object of key/value pairs.
	 * @param overwrite Whether to overwrite existing keys.
	 */
	public async setMany(data: Record<string, D>, overwrite = false): Promise<Josh<D, S>> {
		await this.readyCheck();

		const serialized: Record<string, S> = {};

		for (const [key, value] of Object.entries(data)) serialized[key] = await this.serializer(value, key, '');

		await this.provider.setMany(serialized, overwrite);

		return this;
	}

	/**
	 * Update an existing object in the provider with modified values. Similar to [[Josh.set]] except this does not overwrite the entire object.
	 * Instead, the data is merged with the existing object.
	 * @param keyOrPath Either a key, or full path, of the value you want to update.
	 * @param valueOrFn Either an object, or a function.
	 */
	public async update<V = D>(keyOrPath: string, valueOrFn: ((previousValue: V) => Awaited<Partial<V>>) | Partial<V>): Promise<Josh<D, S>> {
		await this.readyCheck();

		const previousValue = await this.get<V>(keyOrPath);

		if (!previousValue) throw new JoshError('Previous value not found.');

		const value = typeof valueOrFn === 'function' ? await valueOrFn(previousValue) : valueOrFn;

		await this.set(keyOrPath, merge(previousValue, value));

		return this;
	}

	/**
	 * Ensures that the key exist, if not uses the [[Josh.set]] method and returns the `defaultValue`, else uses and returns the value from [[Josh.get]].
	 * @param keyOrPath Either a key, or full path, of the value you want to ensure.
	 * @param defaultValue The value you want to save in the provider if the key does not exist and returns it.
	 */
	public async ensure<V = D>(keyOrPath: string, defaultValue: V) {
		await this.readyCheck();

		const hasSey = await this.has(keyOrPath);

		if (!hasSey) {
			await this.set<V>(keyOrPath, defaultValue);
			return defaultValue;
		}

		return this.get<V>(keyOrPath);
	}

	/**
	 * Delete a key, the property at a specific path, or clear the provider.
	 * @param keyOrPath Either a key or full path. An array of keys or the [[Josh.all]] symbol.
	 */
	public async delete(keyOrPath: string | string[] | symbol): Promise<Josh<D, S>> {
		await this.readyCheck();

		if (Array.isArray(keyOrPath)) {
			await this.provider.deleteMany(keyOrPath);
		} else if (keyOrPath === this.all) {
			await this.provider.clear();
		} else {
			const [key, path] = this.getSeyAndPath(keyOrPath as string);
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
	public async push<V = D>(keyOrPath: string, value: V, allowDupes = true): Promise<Josh<D, S>> {
		await this.readyCheck();

		const [key, path] = this.getSeyAndPath(keyOrPath);
		await this.provider.push<V>(key, path, ((await this.serializer(value as any, key, path)) as unknown) as V, allowDupes);

		return this;
	}

	/**
	 * Remove a value from an array.
	 * @param keyOrPath Either a key, or full path, where you want to remove the value from.
	 * @param valueOrFn Either a value, or a function to match a value stored in the array.
	 */
	public async remove<V = D>(keyOrPath: string, valueOrFn: ((value: V) => Awaited<boolean>) | V): Promise<Josh<D, S>> {
		await this.readyCheck();

		const [key, path] = this.getSeyAndPath(keyOrPath);
		await this.provider.remove(key, path, valueOrFn);

		return this;
	}

	/**
	 * Increments (adds 1 to the number) the stored value in the provider.
	 * @param keyOrPath Either a key, or full path, to the value you want to increment. The value must be a number.
	 */
	public async inc(keyOrPath: string) {
		await this.readyCheck();

		const [key, path] = this.getSeyAndPath(keyOrPath);
		await this.provider.inc(key, path);

		return this;
	}

	/**
	 * Decrements (removes 1 from the number) the stored value in the provider.
	 * @param keyOrPath Either a key, or full path, to the value you want to decrement. The value must be a number.
	 */
	public async dec(keyOrPath: string) {
		await this.readyCheck();

		const [key, path] = this.getSeyAndPath(keyOrPath);
		await this.provider.dec(key, path);

		return this;
	}

	/**
	 * Finds a value with a path and the value to match.
	 * @param path The path to match the value to.
	 * @param value The value to match with the path.
	 */
	public async find(path: string, value: string | number | boolean): Promise<Record<string, D> | null>;
	/**
	 * Finds a value with a function.
	 * @param fn The function to find a value with. Value passed is relative to the `path` paramter, if none, passes full value.
	 * @param path Optional. The path of the value to pass to the function.
	 */
	public async find<V = D>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<Record<string, D> | null>;
	public async find<V = D>(
		pathOrFn: string | ((value: V) => Awaited<boolean>),
		predicate?: string | number | boolean
	): Promise<Record<string, D> | null> {
		await this.readyCheck();

		const found =
			typeof pathOrFn === 'function'
				? await this.provider.findByFn(pathOrFn, predicate as string | undefined)
				: await this.provider.findByValue(pathOrFn, predicate as string | number | boolean);

		if (!found) return null;

		return (await Promise.all(Object.entries(found).map(async ([key, value]) => ({ [key]: await this.deserializer(value) }))))[0];
	}

	/**
	 * Filters values with a path and the value to match.
	 * @param path The path to match the value to.
	 * @param value The value to match with the path.
	 */
	public async filter(path: string, value: string | number | boolean): Promise<Record<string, D>>;
	/**
	 * Filters values with a function.
	 * @param fn The function to filter values with. Value passed is relative to the `path` paramter, if none, passes full value.
	 * @param path Optional. The path of the value to pass to the function.
	 */
	public async filter<V = D>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<Record<string, D>>;
	public async filter<V = D>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<Record<string, D>> {
		await this.readyCheck();

		const data: Record<string, D> = {};

		for (const [key, value] of Object.entries(
			typeof pathOrFn === 'function'
				? await this.provider.filterByFn(pathOrFn, predicate as string | undefined)
				: await this.provider.filterByValue(pathOrFn, predicate as string | number | boolean)
		))
			data[key] = await this.deserializer(value);

		return data;
	}

	/**
	 * Maps over data for each value in the provider.
	 * @param pathOrFn Either a path, or a function.
	 */
	public async map<V = D>(pathOrFn: string | ((value: D) => Awaited<V>)): Promise<V[]> {
		await this.readyCheck();

		return typeof pathOrFn === 'function' ? this.provider.mapByFn(pathOrFn as (value: unknown) => V) : this.provider.mapByPath(pathOrFn);
	}

	/**
	 * Performs like [Array.includes()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes).
	 * @param keyOrPath Either a key, or full path, to the array you want to check for the value.
	 * @param value
	 */
	public async includes<V = D>(keyOrPath: string, value: V) {
		await this.readyCheck();
		const [key, path] = this.getSeyAndPath(keyOrPath);
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
	public async some<V = D>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<boolean>;
	public async some<V = D>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<boolean> {
		await this.readyCheck();

		return typeof pathOrFn === 'function'
			? this.provider.someByFn(pathOrFn, predicate as string | undefined)
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
	public async every<V = D>(fn: (value: V) => Awaited<boolean>, path?: string): Promise<boolean>;
	public async every<V = D>(pathOrFn: string | ((value: V) => Awaited<boolean>), predicate?: string | number | boolean): Promise<boolean> {
		await this.readyCheck();

		return typeof pathOrFn === 'function'
			? this.provider.everyByFn(pathOrFn, predicate as string | undefined)
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

		const [key, path] = this.getSeyAndPath(keyOrPath);

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

		const parsed = JSON.parse(data) as ExportJSON<S>;
		const serialized: Record<string, S> = {};

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
		const deserialized: Record<string, D> = {};

		for (const [key, value] of Object.entries(data)) deserialized[key] = await this.deserializer(value, key);

		return JSON.stringify(
			{
				name: this.name,
				exportTimestamp: Date.now(),
				keys: data,
			} as ExportJSON<S>,
			null,
			2
		);
	}

	/**
	 * Internal method of splitting key and path strings.
	 * @param keyOrPath The key and path to split.
	 */
	private getSeyAndPath(keyOrPath: string): [string, string] {
		const [key, ...path] = keyOrPath.split('.');
		return [key, path.join('.')];
	}

	public static defaultProvider: typeof JoshProvider = MapProvider;

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
