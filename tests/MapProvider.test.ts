import { MapProvider } from '../src';

const provider = new MapProvider({ name: 'tests' });

test('Provider instance is valid', () => {
	expect(provider).toBeInstanceOf(MapProvider);
	expect(provider.name).toBe('tests');
});

test('Provider can be initialized', () => {
	void expect(provider.init()).resolves.toBe(true);
});

test('Provider can be written with all supported values', () => {
	expect(provider.set('object', '', { a: 1, b: 2, c: 3, d: 4 })).toBeInstanceOf(MapProvider);
	expect(provider.set('array', '', [1, 2, 3, 4, 5])).toBeInstanceOf(MapProvider);
	expect(provider.set('number', '', 42)).toBeInstanceOf(MapProvider);
	expect(provider.set('string', '', 'Test string.')).toBeInstanceOf(MapProvider);
	expect(provider.set('boolean', '', false)).toBeInstanceOf(MapProvider);
	expect(
		provider.set('complexObject', '', {
			a: 1,
			b: 2,
			c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
			d: { 1: 'one', 2: 'two' },
		})
	).toBeInstanceOf(MapProvider);
	expect(provider.set('null', '', null)).toBeInstanceOf(MapProvider);
	expect(provider.inc('number', '')).toBeInstanceOf(MapProvider);
	expect(provider.dec('number', '')).toBeInstanceOf(MapProvider);
});

test('Provider returns expected properties', () => {
	expect(provider.count()).toBe(7);
	expect(provider.keys().sort()).toEqual(['array', 'boolean', 'complexObject', 'null', 'number', 'object', 'string'].sort());
	expect(provider.values()).toEqual([
		{ a: 1, b: 2, c: 3, d: 4 },
		[1, 2, 3, 4, 5],
		42,
		'Test string.',
		false,
		{
			a: 1,
			b: 2,
			c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
			d: { 1: 'one', 2: 'two' },
		},
		null,
	]);
	expect(provider.autoId()).toBe('1');
	expect(provider.autoId()).toBe('2');
});

test('Provider can retrieve expected data values', () => {
	expect(provider.get('object', '')).toEqual({ a: 1, b: 2, c: 3, d: 4 });
	expect(provider.get('array', '')).toEqual([1, 2, 3, 4, 5]);
	expect(provider.get('number', '')).toEqual(42);
	expect(provider.get('string', '')).toEqual('Test string.');
	expect(provider.get('boolean', '')).toEqual(false);
	expect(provider.get('complexObject', '')).toEqual({
		a: 1,
		b: 2,
		c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
		d: { 1: 'one', 2: 'two' },
	});
	expect(provider.get('null', '')).toBeNull();
});

test('Provider can read and write in paths', async () => {
	expect(provider.get('object', 'a')).toBe(1);
	expect(provider.get('array', '0')).toBe(1);
	expect(provider.get('complexObject', 'c[4].a[1]')).toBe(2);

	provider.set('object', 'e', 5);
	expect(provider.get('object', 'e')).toBe(5);

	provider.set('array', '5', 6);
	expect(provider.get('array', '5')).toBe(6);

	provider.push('array', '', 7, false);
	expect(provider.get('array', '6')).toBe(7);

	await provider.remove('array', '', 7);
	expect(provider.get('array', '6')).toBeNull();
});

test('Provider can act on many rows at a time', () => {
	expect(provider.getMany(['number', 'boolean'])).toEqual({ number: 42, boolean: false });
	expect(provider.setMany({ new1: 'new1', new2: 'new2' }, true)).toBeInstanceOf(MapProvider);
	expect(provider.count()).toBe(9);
	expect(provider.keys().sort()).toEqual(['string', 'boolean', 'complexObject', 'null', 'number', 'object', 'array', 'new1', 'new2'].sort());
});

test('Provider can delete values and data at paths', async () => {
	provider.delete('new2', '');
	expect(provider.count()).toBe(8);
	expect(provider.keys().sort()).toEqual(['string', 'boolean', 'complexObject', 'null', 'number', 'object', 'array', 'new1'].sort());

	provider.delete('object', 'a');
	expect(provider.count()).toBe(8);
	expect(provider.get('object', '')).toEqual({ b: 2, c: 3, d: 4, e: 5 });

	await provider.remove('array', '', 4);
	expect(provider.get('array', '')).toEqual([1, 2, 3, 5, 6]);
});

test('Database supports math operations', () => {
	provider.math('number', '', 'multiply', 2);
	expect(provider.get('number', '')).toBe(84);
	provider.math('number', '', 'divide', 4);
	expect(provider.get('number', '')).toBe(21);
	provider.math('number', '', 'add', 21);
	expect(provider.get('number', '')).toBe(42);
});

test('Database can loop, filter, find', async () => {
	expect(provider.filterByValue('b', 2)).toEqual({
		object: { b: 2, c: 3, d: 4, e: 5 },
		complexObject: {
			a: 1,
			b: 2,
			c: [1, 2, 3, 4, { a: [1, 2, 3, 4] }],
			d: { 1: 'one', 2: 'two' },
		},
	});
	expect(provider.findByValue('c', 3)).toEqual({ object: { b: 2, c: 3, d: 4, e: 5 } });

	for (let i = 0; i < 200; i++) provider.set(`object${i}`, '', { key: `object${i}`, count: Number(i) });
	// @ts-expect-error 2567
	expect(Object.keys(await provider.filterByFn((v) => Boolean(v && v.count >= 100))).length).toBe(100);
	// @ts-expect-error 2567
	expect((await provider.findByFn((v) => Boolean(v && v.count >= 101))).object101?.key).toBe('object101');
	// @ts-expect-error 2567
	expect(await provider.someByFn((v) => (v ? v.count === 101 : false))).toBe(true);
});

test('Provider can be cleared and destroyed.', () => {
	provider.clear();
	expect(provider.count()).toBe(0);

	provider.destroy();
	expect(provider.count()).toBe(0);
});
