import { storage } from './mmkv';
import type { Settings } from '@/types';

const KEY = 'settings';

const DEFAULT_SETTINGS: Settings = {
  timeRangeStart: '07:00',
  timeRangeEnd: '23:00',
  showWeekends: false,
};

export function getSettings(): Settings {
  const raw = storage.getString(KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return JSON.parse(raw) as Settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  storage.set(KEY, JSON.stringify(settings));
}
