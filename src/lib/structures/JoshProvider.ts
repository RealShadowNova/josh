import type { Awaited } from '../types/Awaited';
import type { Josh } from './Josh';

/**
 * The options for providers. Can be extended.
 * @example
 * ```typescript
 * declare module "@joshdb/core" {
 *   interface JoshProviderOptions {
 *     // Your custom option type-defs.
 *   }
 * }
 * ```
 */
export interface JoshProviderOptions {}

export interface JoshProviderContext<D = unknown, S = D> {
	name?: string;
	instance?: Josh<D, S>;
	options?: JoshProviderOptions;
}

/**
 * The abstract provider class for [[Josh]]
 * @example
 * ```javascript
 * class Provider extends JoshProvider {
 *   // Add all abstract methods here.
 * }
 * ```
 */
export abstract class JoshProvider<D = unknown, S = D> {
	/**
	 * The name of the [[Josh]] instance.
	 */
	public name: string;

	/**
	 * The [[Josh]] instance.
	 */
	public instance?: Josh<D, S>;

	/**
	 * The options for this provider.
	 */
	public options: JoshProviderOptions;

	public constructor(context: JoshProviderContext<D, S>) {
		const { name, options, instance } = context;

		this.name = name ?? 'unknown';
		this.options = options ?? {};
		this.instance = instance;
	}

	public async init() {
		return Promise.resolve(true);
	}

	public abstract has(key: string, path: string): Awaited<boolean>;

	public abstract get<V = S>(key: string, path: string): Awaited<V | null>;
	public abstract getAll(): Awaited<Record<string, S>>;
	public abstract getMany(keys: string[]): Awaited<Record<string, S>>;

	public abstract random(count: number): Awaited<Record<string, S>>;
	public abstract randomKey(count: number): Awaited<string[]>;

	public abstract keys(): Awaited<string[]>;
	public abstract values(): Awaited<S[]>;
	public abstract count(): Awaited<number>;

	public abstract set<V = S>(key: string, path: string, value: V): Awaited<JoshProvider<D, S>>;
	public abstract setMany(data: Record<string, S>, overwrite: boolean): Awaited<JoshProvider<D, S>>;

	public abstract delete(key: string, path: string): Awaited<JoshProvider<D, S>>;
	public abstract clear(): Awaited<JoshProvider<D, S>>;
	public abstract deleteMany(keysOrPaths: string[]): Awaited<JoshProvider<D, S>>;

	public abstract push<V = S>(key: string, path: string, value: V, allowDupes: boolean): Awaited<JoshProvider<D, S>>;
	public abstract remove<V = S>(key: string, path: string, valueOrFn: V | ((value: V) => Awaited<boolean>)): Awaited<JoshProvider<D, S>>;

	public abstract inc(key: string, path: string): Awaited<JoshProvider<D, S>>;
	public abstract dec(key: string, path: string): Awaited<JoshProvider<D, S>>;

	public abstract findByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string): Awaited<Record<string, S> | null>;
	public abstract findByValue(path: string, value: string | number | boolean): Awaited<Record<string, S> | null>;

	public abstract filterByFn<V = S>(fn: ((value: V) => Awaited<boolean>) | string, path?: string): Awaited<Record<string, S>>;
	public abstract filterByValue(path: string, value: string | number | boolean): Awaited<Record<string, S>>;

	public abstract mapByFn<V = S>(fn: (value: unknown) => Awaited<V>): Awaited<V[]>;
	public abstract mapByPath<V = S>(path: string): Awaited<V[]>;

	public abstract includes<V = S>(key: string, path: string, value: V): Awaited<boolean>;

	public abstract someByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string): Awaited<boolean>;
	public abstract someByValue(path: string, value: string | number | boolean): Awaited<boolean>;

	public abstract everyByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string): Awaited<boolean>;
	public abstract everyByValue(path: string, value: string | number | boolean): Awaited<boolean>;

	public abstract math(key: string, path: string, operation: string, operand: number): Awaited<JoshProvider<D, S>>;

	public abstract autoId(): Awaited<string>;

	public abstract destroy(): Awaited<void>;

	/**
	 * Internal method of splitting key and path strings.
	 * @param keyOrPath The key and path to split.
	 */
	protected getKeyAndPath(keyOrPath: string): [string, string] {
		const [key, ...path] = keyOrPath.split('.');
		return [key, path.join('.')];
	}
}
