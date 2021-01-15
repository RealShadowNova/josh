import type { BaseJoshProvider } from '../structures/BaseJoshProvider';
import type { Awaited } from './Awaited';

export interface JoshOptions<T = unknown, K = T> {
  provider: typeof BaseJoshProvider;
  providerOptions: Record<string, unknown>;
  name?: string;
  ensureProps?: boolean;
  autoEnsure?: K;
  serializer?: (data: T | unknown, key?: string, path?: string) => Awaited<K>;
  deserializer?: (data: K | unknown, key?: string, path?: string) => Awaited<T>;
}
