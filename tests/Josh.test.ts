import { Josh } from '../src/index';

test('Creating a new Josh instance should fail without name option', () => {
	// @ts-expect-error 2554
	expect(() => new Josh()).toThrow();
});

interface DUser {
	id: string;
	username: string;
	friends: DUser[];
}

interface SUser {
	id: string;
	username: string;
	friends: string[];
}

const users = new Josh<DUser, SUser>({ name: 'users' });

test('Josh can set deserializer and serializer', () => {
	expect(
		users.setDeserializer(async ({ id, username, friends }) => ({
			id,
			username,
			friends: await Promise.all(friends.map(async (friend) => (await users.get(friend))!)),
		}))
	).toBeInstanceOf(Josh);
	expect(
		users.setSerializer(({ id, username, friends }) => ({
			id,
			username,
			friends: friends.map((friend) => friend.id),
		}))
	).toBeInstanceOf(Josh);
});

test('Josh can read and write expected values', async () => {
	for (let i = 0; i < 100; i++) {
		const id = await users.autoId();
		await expect(users.set(id, { id, username: `user${id}`, friends: [] })).resolves.toBeInstanceOf(Josh);
		await expect(users.get(id)).resolves.toEqual<DUser>({ id, username: `user${id}`, friends: [] });
	}

	void expect(users.size).resolves.toBe<number>(100);
	void expect(users.keys).resolves.toContain<string>('1');
});

test('Josh can utilize deserialization and serialization', async () => {
	const id = await users.autoId();

	await expect(
		users.set<DUser>(id, { id, username: `user${id}`, friends: await users.values })
	).resolves.toBeInstanceOf(Josh);

	await expect(users.get<DUser>(id)).resolves.toEqual<DUser>({
		id,
		username: `user${id}`,
		friends: (await users.values).filter((user) => user.id !== '101'),
	});
});

test('Josh can filter and find', () => {
	void expect(users.find((user) => user.id === '1')).resolves.toEqual<Record<string, DUser>>({ 1: { id: '1', username: 'user1', friends: [] } });
	void expect(users.find('id', '1')).resolves.toEqual<Record<string, DUser>>({ 1: { id: '1', username: 'user1', friends: [] } });

	void expect(users.filter((user) => user.id === '1')).resolves.toEqual<Record<string, DUser>>({ 1: { id: '1', username: 'user1', friends: [] } });
	void expect(users.filter('id', '1')).resolves.toEqual<Record<string, DUser>>({ 1: { id: '1', username: 'user1', friends: [] } });
});

test('Josh can be cleared', async () => {
	await expect(users.delete(users.all)).resolves.toBeInstanceOf(Josh);
	void expect(users.size).resolves.toBe<number>(0);
});
