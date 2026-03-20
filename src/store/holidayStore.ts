import { storage } from './mmkv';
import type { HolidayInfo } from '@/types';

// MMKV 키 형식: "holidays-{year}" (예: "holidays-2026")
function key(year: number): string {
    return `holidays-${year}`;
}

/** 해당 연도 공휴일 목록 반환 (없으면 빈 배열) */
export function getHolidays(year: number): HolidayInfo[] {
    const raw = storage.getString(key(year));
    if (!raw) return [];
    try {
        return JSON.parse(raw) as HolidayInfo[];
    } catch {
        return [];
    }
}

/** 해당 연도 공휴일 목록 저장 */
export function saveHolidays(year: number, holidays: HolidayInfo[]): void {
    storage.set(key(year), JSON.stringify(holidays));
}

/** 해당 연도 공휴일 데이터가 이미 캐시되어 있는지 확인 */
export function hasHolidaysForYear(year: number): boolean {
    return storage.contains(key(year));
}
