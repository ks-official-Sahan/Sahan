export interface SettingRow {
  key: string;
  value: unknown;
}

export interface SettingRepo {
  find(key: string): Promise<SettingRow | null>;
  findMany(keys: string[]): Promise<SettingRow[]>;
  upsert(key: string, value: unknown, updatedById: string): Promise<void>;
}
