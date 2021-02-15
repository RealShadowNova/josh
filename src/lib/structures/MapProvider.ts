import { get, has, isPlainObject, set, unset } from 'lodash';
import type { Awaited } from '../types/Awaited';
import { JoshProvider } from './JoshProvider';
import { JoshError } from './JoshError';

export class MapProvider<D = unknown, S = D> extends JoshProvider<D, S> {
	private cache = new Map<string, S>();

	private ids = 0;

	public has(key: string, path: string) {
		return path.length ? has(this.cache.get(key), path) : this.cache.has(key);
	}

	public get<V = S>(key: string, path: string): V | null {
		return path.length ? get(this.cache.get(key), path) ?? null : this.cache.get(key) ?? null;
	}

	public getAll() {
		const data: Record<string, S> = {};

		for (const [key, value] of this.cache.entries()) data[key] = value;

		return data;
	}

	public getMany(keys: string[]) {
		const data: Record<string, S> = {};

		for (const [key, value] of this.cache.entries()) {
			if (!keys.includes(key)) continue;
			data[key] = value;
		}

		return data;
	}

	public random(count: number) {
		const data: Record<string, S> = {};
		const entries = Array.from({ length: count }, () => [...this.cache.entries()].splice(Math.floor(Math.random() * this.cache.size), 1)[0]);

		for (const [key, value] of entries) data[key] = value;

		return data;
	}

	public randomKey(count: number) {
		return Array.from({ length: count }, () => [...this.cache.keys()].splice(Math.floor(Math.random() * this.cache.size), 1)[0]);
	}

	public keys() {
		return [...this.cache.keys()];
	}

	public values() {
		return [...this.cache.values()];
	}

	public count() {
		return this.cache.size;
	}

	public set<V = S>(key: string, path: string, value: V) {
		if (path.length) {
			const val = this.get(key, '');

			this.cache.set(key, (set((val as unknown) as Record<any, any>, path, value) as unknown) as S);
		} else this.cache.set(key, (value as unknown) as S);

		return this;
	}

	public setMany(data: Record<string, S>, overwrite: boolean) {
		for (const [key, value] of Object.entries(data)) {
			if (!overwrite && this.cache.has(key)) continue;
			this.cache.set(key, value);
		}

		return this;
	}

	public delete(key: string, path: string) {
		if (path.length) {
			const value = this.get(key, '');

			if (value && isPlainObject(value) && value !== null) {
				unset(value, path);
				this.cache.set(key, value);
			}
		} else this.cache.delete(key);

		return this;
	}

	public clear() {
		this.cache.clear();
		return this;
	}

	public deleteMany(keysOrPaths: string[]) {
		for (const [key, path] of keysOrPaths.map((keyOrPath) => this.getKeyAndPath(keyOrPath))) this.delete(key, path);

		return this;
	}

	public push<V = S>(key: string, path: string, value: V, allowDupes: boolean) {
		const val = this.get<V>(key, path);

		if (Array.isArray(val) && !allowDupes && !(val as unknown[]).find((v) => v === value)) {
			(val as unknown[]).push(value);
			this.set(key, path, val);
		}

		return this;
	}

	public async remove<V = S>(key: string, path: string, valueOrFn: V | ((value: V) => Awaited<boolean>)) {
		const val = this.get<V>(key, path);

		if (Array.isArray(val)) {
			const data = [];

			for (const v of val as unknown[]) {
				if (typeof valueOrFn === 'function') {
					const found = await (valueOrFn as (value: unknown) => Awaited<boolean>)(v);
					if (!found) continue;
					data.push(v);
				} else {
					if (v === valueOrFn) continue;
					data.push(v);
				}
			}

			this.set(key, path, data);
		}

		return this;
	}

	public inc(key: string, path: string) {
		let value = this.get(key, path);

		if (typeof value === 'number') {
			value++;
			this.set(key, path, value);
		}

		return this;
	}

	public dec(key: string, path: string) {
		let value = this.get(key, path);

		if (typeof value === 'number') {
			value--;
			this.set(key, path, value);
		}

		return this;
	}

	public async findByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string) {
		for (const [key, value] of this.cache.entries()) {
			if (path?.length) {
				const val = this.get<V>(key, path);

				if (!val) continue;

				const found = await fn(val);
				if (!found) continue;
				return { [key]: value };
			}

			const found = await fn((value as unknown) as V);
			if (!found) continue;
			return { [key]: value };
		}

		return null;
	}

	public findByValue(path: string, value: string | number | boolean) {
		for (const [key, val] of this.cache.entries()) {
			const v = this.get(key, path);

			if (!v) continue;

			// @ts-expect-error 2367
			if (v !== value) continue;

			return { [key]: val };
		}

		return null;
	}

	public async filterByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string) {
		const data: Record<string, S> = {};

		for (const [key, value] of this.cache.entries()) {
			if (path?.length) {
				const val = this.get<V>(key, path);

				if (!val) continue;

				const found = await fn(val);
				if (!found) continue;
				data[key] = value;
			}

			const found = await fn((value as unknown) as V);
			if (!found) continue;
			data[key] = value;
		}

		return data;
	}

	public filterByValue(path: string, value: string | number | boolean) {
		const data: Record<string, S> = {};

		for (const [key, val] of this.cache.entries()) {
			const v = this.get(key, path);

			if (!v) continue;

			// @ts-expect-error 2367
			if (v !== value) continue;

			data[key] = val;
		}

		return data;
	}

	public async mapByFn<V = S>(fn: (value: unknown) => Awaited<V>, path?: string) {
		return Promise.all(
			[...this.cache.entries()].map(async ([key, value]) => (path?.length ? fn(this.get<V>(key, path)!) : fn((value as unknown) as V)))
		);
	}

	public mapByPath<V = S>(path: string) {
		return [...this.cache.keys()].map((key) => this.get<V>(key, path)!);
	}

	public includes<V = S>(key: string, path: string, value: V) {
		const val = this.get(key, path);

		if (!val) return false;
		if (!Array.isArray(val)) return false;

		return val.includes(value);
	}

	public async someByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string) {
		for (const [key, value] of this.cache.entries()) {
			if (path?.length) {
				const val = this.get<V>(key, path);

				if (!val) continue;

				const found = await fn(val);
				if (!found) continue;
				return true;
			}

			const found = await fn((value as unknown) as V);
			if (!found) continue;
			return true;
		}

		return false;
	}

	public someByValue(path: string, value: string | number | boolean) {
		for (const key of this.cache.keys()) {
			const val = this.get(key, path);

			if (!val) continue;

			// @ts-expect-error 2367
			if (val !== value) continue;

			return true;
		}

		return false;
	}

	public async everyByFn<V = S>(fn: (value: V) => Awaited<boolean>, path?: string) {
		let every = true;

		for (const [key, value] of this.cache.entries()) {
			if (path?.length) {
				const val = this.get<V>(key, path);

				if (!val) continue;

				const found = await fn(val);
				if (found) continue;
				every = false;
			}

			const found = await fn((value as unknown) as V);
			if (found) continue;
			every = false;
		}

		return every;
	}

	public everyByValue(path: string, value: string | number | boolean) {
		let every = true;

		for (const key of this.cache.keys()) {
			const val = this.get(key, path);

			if (!val) continue;

			// @ts-expect-error 2367
			if (val === value) continue;

			every = false;
		}

		return every;
	}

	public math(key: string, path: string, operation: string, operand: number) {
		let value = this.get(key, path) as number | null;

		if (!value) throw new JoshError(`Value in "${key}.${path}" was not found.`);

		switch (operation) {
			case 'add':
			case 'addition':
			case '+':
				value += operand;
				break;
			case 'sub':
			case 'subtract':
			case '-':
				value -= operand;
				break;
			case 'multi':
			case 'multiply':
			case '*':
				value *= operand;
				break;
			case 'div':
			case 'divide':
			case '/':
				value /= operand;
				break;
			case 'exp':
			case 'exponent':
			case '^':
				value = Math.pow(value, operand);
				break;
			case 'mod':
			case 'modulo':
			case '%':
				value %= operand;
				break;
			case 'rand':
			case 'random':
				value = Math.floor(Math.random() * Math.floor(operand));
				break;
		}

		this.set(key, path, value);

		return this;
	}

	public autoId() {
		this.ids++;
		return this.ids.toString();
	}

	public destroy() {
		this.cache.clear();
	}
}
