// 공유용 정적 시간표 뷰 — 전체 시간표를 A4 비율 이미지로 캡처
import React from 'react';
import { View, Text } from 'react-native';
import type { Timetable } from '@/types';
import {
    ALL_DAYS,
    TIME_COL_WIDTH,
    SCREEN_WIDTH,
    generateTimeLabels,
    formatTimeLabel,
} from './constants';
import { timeToMinutes } from '@/utils/time';
import { cn } from '@/utils/cn';

// A4 비율(210:297)에 맞게 이미지 높이 계산
const A4_RATIO = 297 / 210;
// 그리드 외 고정 높이: 타이틀(45) + 요일 헤더(32) + paddingBottom(16)
const SHARE_OVERHEAD = 93;

export function TimetableShareView({ timetable }: { timetable: Timetable }) {
    const ttStart = timetable.timeRangeStart ?? '07:00';
    const ttEnd = timetable.timeRangeEnd ?? '23:00';
    const showWeekends = timetable.showWeekends ?? false;
    const days = showWeekends ? ALL_DAYS : ALL_DAYS.slice(0, 5);
    const startMin = timeToMinutes(ttStart);
    const endMin = timeToMinutes(ttEnd);
    const totalMin = endMin - startMin;
    // A4 비율 전체 높이에서 헤더 영역을 뺀 나머지를 그리드에 할당
    const gridHeight = SCREEN_WIDTH * A4_RATIO - SHARE_OVERHEAD;
    const cellH = gridHeight / totalMin;
    const labels = generateTimeLabels(ttStart, ttEnd);
    const nDays = days.length;
    const colW = (SCREEN_WIDTH - TIME_COL_WIDTH) / nDays;

    return (
        <View
            className="bg-white pb-4"
            style={{ width: SCREEN_WIDTH }}
        >
            <Text className="text-center text-base font-bold py-3 text-[#111827]">
                {timetable.name}
            </Text>
            <View className="flex-row border-b border-[#e5e7eb] bg-[#f9fafb] py-1.5">
                <View style={{ width: TIME_COL_WIDTH }} />
                {days.map((day, i) => (
                    <View
                        key={day}
                        className="items-center"
                        style={{ width: colW }}
                    >
                        <Text
                            className={cn(
                                'text-[13px] font-semibold',
                                i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-[#374151]',
                            )}
                        >
                            {day}
                        </Text>
                    </View>
                ))}
            </View>
            <View className="flex-row" style={{ height: gridHeight }}>
                <View className="relative" style={{ width: TIME_COL_WIDTH }}>
                    {labels.map((label, i) => {
                        const { ampm, hour } = formatTimeLabel(label);
                        return (
                            <Text
                                key={label}
                                className="absolute right-2 text-[10px] text-[#9ca3af]"
                                style={{ top: i * 60 * cellH - 6 }}
                            >
                                {ampm}{' '}
                                <Text className="text-sm font-medium">
                                    {hour}
                                </Text>
                                시
                            </Text>
                        );
                    })}
                </View>
                {days.map((day, dayIndex) => (
                    <View
                        key={day}
                        className="relative border-l border-[#f3f4f6]"
                        style={{ width: colW, height: gridHeight }}
                    >
                        {labels.map((label, i) => (
                            <View
                                key={label}
                                className="absolute left-0 right-0 border-t border-[#f3f4f6]"
                                style={{ top: i * 60 * cellH }}
                            />
                        ))}
                        {timetable.schedules
                            .filter(s => s.dayOfWeek.includes(dayIndex))
                            .map(schedule => {
                                const top =
                                    (timeToMinutes(schedule.startTime) -
                                        startMin) *
                                    cellH;
                                const height = Math.max(
                                    (timeToMinutes(schedule.endTime) -
                                        timeToMinutes(schedule.startTime)) *
                                        cellH,
                                    cellH * 2,
                                );
                                return (
                                    <View
                                        key={schedule.id}
                                        className="absolute left-px right-px rounded overflow-hidden p-0.5"
                                        style={{
                                            top,
                                            height,
                                            backgroundColor: schedule.color,
                                        }}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            className="text-[10px] font-bold text-[#1f2937]"
                                        >
                                            {schedule.title}
                                        </Text>
                                        {schedule.subTitle && (
                                            <Text
                                                numberOfLines={1}
                                                className="text-[8px] text-[#4b5563]"
                                            >
                                                {schedule.subTitle}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })}
                    </View>
                ))}
            </View>
        </View>
    );
}
