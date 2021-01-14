export interface ExportJSON<K = unknown> {
  name: string;
  exportTimestamp: number;
  keys: Record<string, K>;
}
