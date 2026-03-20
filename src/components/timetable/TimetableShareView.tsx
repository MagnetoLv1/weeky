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
    <View style={{ width: SCREEN_WIDTH, backgroundColor: 'white', paddingBottom: 16 }}>
      <Text
        style={{
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 'bold',
          paddingVertical: 12,
          color: '#111827',
        }}
      >
        {timetable.name}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderColor: '#e5e7eb',
          backgroundColor: '#f9fafb',
          paddingVertical: 6,
        }}
      >
        <View style={{ width: TIME_COL_WIDTH }} />
        {days.map((day, i) => (
          <View key={day} style={{ width: colW, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: i === 5 ? '#3b82f6' : i === 6 ? '#ef4444' : '#374151',
              }}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', height: gridHeight }}>
        <View style={{ width: TIME_COL_WIDTH, position: 'relative' }}>
          {labels.map((label, i) => {
            const { ampm, hour } = formatTimeLabel(label);
            return (
              <Text
                key={label}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: i * 60 * cellH - 6,
                  fontSize: 10,
                  color: '#9ca3af',
                }}
              >
                {ampm}{' '}
                <Text style={{ fontSize: 14, fontWeight: '500' }}>{hour}</Text>시
              </Text>
            );
          })}
        </View>
        {days.map((day, dayIndex) => (
          <View
            key={day}
            style={{
              width: colW,
              height: gridHeight,
              position: 'relative',
              borderLeftWidth: 1,
              borderColor: '#f3f4f6',
            }}
          >
            {labels.map((label, i) => (
              <View
                key={label}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: i * 60 * cellH,
                  borderTopWidth: 1,
                  borderColor: '#f3f4f6',
                }}
              />
            ))}
            {timetable.schedules
              .filter(s => s.dayOfWeek.includes(dayIndex))
              .map(schedule => {
                const top =
                  (timeToMinutes(schedule.startTime) - startMin) * cellH;
                const height = Math.max(
                  (timeToMinutes(schedule.endTime) -
                    timeToMinutes(schedule.startTime)) *
                    cellH,
                  cellH * 2,
                );
                return (
                  <View
                    key={schedule.id}
                    style={{
                      position: 'absolute',
                      top,
                      height,
                      left: 1,
                      right: 1,
                      backgroundColor: schedule.color,
                      borderRadius: 4,
                      overflow: 'hidden',
                      padding: 2,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 10, fontWeight: 'bold', color: '#1f2937' }}
                    >
                      {schedule.title}
                    </Text>
                    {schedule.subTitle && (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 8, color: '#4b5563' }}
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
