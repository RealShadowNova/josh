import type { Josh } from '../structures/Josh';

export interface JoshProviderOptions<K = unknown> {
  name: string;
  instance: Josh<unknown, K>;
  options: Record<string, unknown>;
}
