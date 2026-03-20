// 인접 시간표 미리보기 (스와이프 전환 시 배경에 렌더, React.memo로 불필요 리렌더 방지)
import React from 'react';
import { View, Text, Platform, StatusBar } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { cn } from '@/utils/cn';
import type { Timetable } from '@/types';
import {
    ALL_DAYS,
    TIME_COL_WIDTH,
    MIN_CELL_HEIGHT,
    SCREEN_WIDTH,
    getTodayIndex,
    generateTimeLabels,
    formatTimeLabel,
} from './constants';
import { HeaderContainer } from './HeaderContainer';
import { timeToMinutes } from '@/utils/time';

// 타이틀 영역 48px + 요일 헤더 44px — MainScreen의 ScrollView paddingTop과 동일해야 함
export const HEADER_CONTENT_HEIGHT = 92;

export const StaticTimetableGrid = React.memo(
    ({ timetable }: { timetable: Timetable }) => {
        const insets = useSafeAreaInsets();
        const topInset =
            Platform.OS === 'android'
                ? StatusBar.currentHeight ?? 0
                : insets.top;
        const ttStart = timetable.timeRangeStart ?? '07:00';
        const ttEnd = timetable.timeRangeEnd ?? '23:00';
        const ttShowWeekends = timetable.showWeekends ?? false;
        const daysArr = ttShowWeekends ? ALL_DAYS : ALL_DAYS.slice(0, 5);
        const nDays = daysArr.length;
        const labels = generateTimeLabels(ttStart, ttEnd);
        const sMin = timeToMinutes(ttStart);
        const eMin = timeToMinutes(ttEnd);
        const gHeight = (eMin - sMin) * MIN_CELL_HEIGHT;
        const colW = (SCREEN_WIDTH - TIME_COL_WIDTH) / nDays;
        const today = getTodayIndex();

        return (
            <View className="flex-1 bg-white">
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingTop: topInset + HEADER_CONTENT_HEIGHT,
                    }}
                >
                    <View className="flex-row">
                        <View className="w-[58px]">
                            {labels.map(label => {
                                const { ampm, hour } = formatTimeLabel(label);
                                return (
                                    <View
                                        key={label}
                                        className="items-end pr-2 h-[90px]"
                                    >
                                        <Text className="text-[10px] text-[#9ca3af] -mt-[6px]">
                                            {ampm}{' '}
                                            <Text className="text-[14px] font-medium">
                                                {hour}
                                            </Text>
                                            시
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                        {daysArr.map((day, dayIndex) => (
                            <View
                                key={day}
                                className="relative border-l border-[#f3f4f6]"
                                style={{ width: colW, height: gHeight }}
                            >
                                {labels.map((label, i) => (
                                    <View
                                        key={label}
                                        className="absolute left-0 right-0 border-t border-[#f3f4f6]"
                                        style={{
                                            top: i * 60 * MIN_CELL_HEIGHT,
                                        }}
                                    />
                                ))}
                                {timetable.schedules
                                    .filter(s => s.dayOfWeek.includes(dayIndex))
                                    .map(schedule => {
                                        const sTop =
                                            (timeToMinutes(schedule.startTime) -
                                                sMin) *
                                            MIN_CELL_HEIGHT;
                                        const sH = Math.max(
                                            (timeToMinutes(schedule.endTime) -
                                                timeToMinutes(
                                                    schedule.startTime,
                                                )) *
                                                MIN_CELL_HEIGHT,
                                            MIN_CELL_HEIGHT * 2,
                                        );
                                        return (
                                            <View
                                                key={schedule.id}
                                                className="absolute rounded-[4px] overflow-hidden"
                                                style={{
                                                    top: sTop,
                                                    height: sH,
                                                    left: 1,
                                                    right: 1,
                                                    backgroundColor:
                                                        schedule.color,
                                                }}
                                            >
                                                <View className="p-1">
                                                    <Text
                                                        numberOfLines={1}
                                                        className="text-[12px] font-bold text-[#1f2937]"
                                                    >
                                                        {schedule.title}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                            </View>
                        ))}
                    </View>
                </Animated.ScrollView>
                <HeaderContainer>
                    <View
                        className="px-4 pb-2"
                        style={{ paddingTop: topInset }}
                    >
                        <View className="flex-row items-start min-h-[40px]">
                            <View className="flex-1 py-1">
                                <View className="flex-row items-center gap-[4px]">
                                    <Text className="text-[18px] font-bold text-[#111827]">
                                        {timetable.name}
                                    </Text>
                                    <ChevronDown size={16} color="#9ca3af" />
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className="flex-row border-b border-[#e5e7eb] h-[44px]">
                        <View className="w-[58px]" />
                        {daysArr.map((day, i) => (
                            <View
                                key={day}
                                className="items-center justify-center"
                                style={{ width: colW }}
                            >
                                <View
                                    className={cn(
                                        'w-8 h-8 rounded-full items-center justify-center',
                                        i === today && 'bg-blue-500',
                                    )}
                                >
                                    <Text
                                        className={cn(
                                            'text-[13px] font-semibold',
                                            i === today
                                                ? 'text-white'
                                                : i === 5
                                                ? 'text-blue-500'
                                                : i === 6
                                                ? 'text-red-500'
                                                : 'text-[#374151]',
                                        )}
                                    >
                                        {day}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </HeaderContainer>
            </View>
        );
    },
);
