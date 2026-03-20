import { storage } from './mmkv';
import type { Timetable } from '@/types';

const KEY = 'timetables';

const DEFAULT_TIMETABLE: Timetable = {
    id: 'default',
    name: '시간표',
    order: 0,
    schedules: [],
};

export function getTimetables(): Timetable[] {
    const raw = storage.getString(KEY);
    if (!raw) return [DEFAULT_TIMETABLE];
    try {
        const parsed = JSON.parse(raw) as Timetable[];
        // 빈 배열이면 기본 시간표 반환
        return parsed.length > 0 ? parsed : [DEFAULT_TIMETABLE];
    } catch {
        return [DEFAULT_TIMETABLE];
    }
}

export function saveTimetables(timetables: Timetable[]): void {
    storage.set(KEY, JSON.stringify(timetables));
}

/** 앱 최초 실행 시 1회만 기본 시간표를 저장 */
export function initTimetablesIfNeeded(): void {
    const raw = storage.getString(KEY);
    if (!raw) {
        saveTimetables([DEFAULT_TIMETABLE]);
    }
}
