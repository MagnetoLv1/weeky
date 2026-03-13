import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Bell, ChevronLeft, ChevronRight, Plus, Settings as SettingsIcon } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getTimetables, saveTimetables } from '../store/timetableStore';
import { getSettings } from '../store/settingsStore';
import type { Timetable, Schedule, Settings } from '../types';
import { timeToMinutes } from '../utils/time';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
};

const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_COL_WIDTH = 44;
const MIN_CELL_HEIGHT = 3; // 10분 = 3dp
const HEADER_HEIGHT = 44;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ZOOM_DURATION = 250;
const SLIDE_DURATION = 300;

function getTodayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function generateTimeLabels(start: string, end: string): string[] {
  const labels: string[] = [];
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  for (let m = startMin; m <= endMin; m += 60) {
    const h = Math.floor(m / 60);
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
  return labels;
}

function triggerHaptic() {
  ReactNativeHapticFeedback.trigger('impactMedium', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
}

export default function MainScreen({ navigation }: Props) {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [settings, setSettings] = useState<Settings>({
    timeRangeStart: '07:00',
    timeRangeEnd: '23:00',
    showWeekends: false,
  });
  const [zoomedDay, setZoomedDay] = useState<number | null>(null);
  const todayIndex = getTodayIndex();

  // 슬라이드 전환 애니메이션
  const translateX = useSharedValue(0);

  // 7개 요일 컬럼 너비 (ALL_DAYS 인덱스 기준)
  const colW0 = useSharedValue(0);
  const colW1 = useSharedValue(0);
  const colW2 = useSharedValue(0);
  const colW3 = useSharedValue(0);
  const colW4 = useSharedValue(0);
  const colW5 = useSharedValue(0);
  const colW6 = useSharedValue(0);
  const colWs = [colW0, colW1, colW2, colW3, colW4, colW5, colW6];

  const colStyle0 = useAnimatedStyle(() => ({ width: colW0.value, overflow: 'hidden' }));
  const colStyle1 = useAnimatedStyle(() => ({ width: colW1.value, overflow: 'hidden' }));
  const colStyle2 = useAnimatedStyle(() => ({ width: colW2.value, overflow: 'hidden' }));
  const colStyle3 = useAnimatedStyle(() => ({ width: colW3.value, overflow: 'hidden' }));
  const colStyle4 = useAnimatedStyle(() => ({ width: colW4.value, overflow: 'hidden' }));
  const colStyle5 = useAnimatedStyle(() => ({ width: colW5.value, overflow: 'hidden' }));
  const colStyle6 = useAnimatedStyle(() => ({ width: colW6.value, overflow: 'hidden' }));
  const colStyles = [colStyle0, colStyle1, colStyle2, colStyle3, colStyle4, colStyle5, colStyle6];

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      const tt = getTimetables();
      setTimetables(tt);
      setSettings(getSettings());
    }, []),
  );

  const activeTimetable = timetables[activeIndex];
  const days = settings.showWeekends ? ALL_DAYS : ALL_DAYS.slice(0, 5);
  const numDays = days.length;
  const timeLabels = generateTimeLabels(settings.timeRangeStart, settings.timeRangeEnd);
  const startMin = timeToMinutes(settings.timeRangeStart);
  const endMin = timeToMinutes(settings.timeRangeEnd);
  const gridHeight = (endMin - startMin) * MIN_CELL_HEIGHT;
  const availableWidth = SCREEN_WIDTH - TIME_COL_WIDTH;

  // 컬럼 너비 업데이트 (줌 상태 변경 시)
  useEffect(() => {
    const normalW = availableWidth / numDays;
    for (let i = 0; i < 7; i++) {
      let w: number;
      if (i >= numDays) {
        w = 0; // 주말 미표시
      } else if (zoomedDay === null) {
        w = normalW;
      } else if (i === zoomedDay) {
        w = availableWidth * 0.56; // 줌된 요일: 56%
      } else if (Math.abs(i - zoomedDay) === 1) {
        w = availableWidth * 0.22; // 인접 요일: 22% (약 30% 노출)
      } else {
        w = 0; // 비인접 요일: 숨김
      }
      colWs[i].value = withTiming(w, { duration: ZOOM_DURATION });
    }
  }, [zoomedDay, numDays, availableWidth]);

  // 타이틀 영역 스와이프 → 시간표 전환
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .runOnJS(true)
    .onEnd(e => {
      const isSwipe = Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 400;
      if (!isSwipe) return;
      if (e.translationX < 0 && activeIndex < timetables.length - 1) {
        translateX.value = SCREEN_WIDTH;
        setActiveIndex(activeIndex + 1);
        translateX.value = withTiming(0, { duration: SLIDE_DURATION });
      } else if (e.translationX > 0 && activeIndex > 0) {
        translateX.value = -SCREEN_WIDTH;
        setActiveIndex(activeIndex - 1);
        translateX.value = withTiming(0, { duration: SLIDE_DURATION });
      }
    });

  // 롱프레스 후 onPress가 추가로 호출되는 것 방지
  const isLongPressActive = useRef(false);
  // 더블탭 감지용 (요일별 마지막 탭 시각)
  const lastTapMs = useRef<number[]>(new Array(7).fill(0));

  function handleCellLongPress(dayIndex: number, hour: number) {
    isLongPressActive.current = true;
    triggerHaptic();
    const hh = String(hour).padStart(2, '0');
    navigation.navigate('ScheduleForm', {
      defaultDay: dayIndex,
      defaultStartTime: `${hh}:00`,
      defaultEndTime: `${hh}:50`,
      timetableId: activeTimetable?.id,
    });
    setTimeout(() => { isLongPressActive.current = false; }, 300);
  }

  function handleCellPress(dayIndex: number) {
    if (isLongPressActive.current) return;
    const now = Date.now();
    if (now - lastTapMs.current[dayIndex] < 300) {
      // 더블탭 → 줌 토글
      setZoomedDay(prev => (prev === dayIndex ? null : dayIndex));
      lastTapMs.current[dayIndex] = 0;
    } else {
      lastTapMs.current[dayIndex] = now;
    }
  }

  function handleSchedulePress(schedule: Schedule) {
    navigation.navigate('ScheduleForm', {
      schedule,
      timetableId: activeTimetable?.id,
    });
  }

  function getBlockStyle(schedule: Schedule) {
    const top = (timeToMinutes(schedule.startTime) - startMin) * MIN_CELL_HEIGHT;
    const height = Math.max(
      (timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)) * MIN_CELL_HEIGHT,
      MIN_CELL_HEIGHT * 2,
    );
    return { top, height };
  }

  function handleAddTimetable() {
    const newTt: Timetable = {
      id: Date.now().toString(),
      name: `시간표 ${timetables.length + 1}`,
      order: timetables.length,
      schedules: [],
    };
    const updated = [...timetables, newTt];
    saveTimetables(updated);
    setTimetables(updated);
    translateX.value = SCREEN_WIDTH;
    setActiveIndex(updated.length - 1);
    translateX.value = withTiming(0, { duration: SLIDE_DURATION });
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* 앱 헤더 (고정) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* 타이틀 + 스와이프 영역 */}
          <GestureDetector gesture={panGesture}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingVertical: 4, gap: 6 }}>
              <ChevronLeft size={16} color={activeIndex > 0 ? '#9ca3af' : 'transparent'} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                {activeTimetable?.name ?? '시간표'}
              </Text>
              <ChevronRight size={16} color={activeIndex < timetables.length - 1 ? '#9ca3af' : 'transparent'} />
              {timetables.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 3, marginLeft: 2 }}>
                  {timetables.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        borderRadius: 99,
                        width: i === activeIndex ? 12 : 6,
                        height: 6,
                        backgroundColor: i === activeIndex ? '#3b82f6' : '#d1d5db',
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          </GestureDetector>

          {/* 버튼 */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {zoomedDay !== null && (
              <TouchableOpacity
                style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setZoomedDay(null)}
              >
                <Text style={{ fontSize: 12, color: '#6b7280' }}>전체</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
              onPress={handleAddTimetable}
            >
              <Plus size={20} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => navigation.navigate('Settings')}
            >
              <SettingsIcon size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 요일 헤더 + 시간표 그리드 (슬라이드 대상) */}
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        {/* 요일 헤더 */}
        <View style={{ flexDirection: 'row', height: HEADER_HEIGHT, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
          <View style={{ width: TIME_COL_WIDTH }} />
          {ALL_DAYS.map((day, i) => (
            <Animated.View
              key={day}
              style={[colStyles[i], { alignItems: 'center', justifyContent: 'center' }]}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: i === todayIndex ? '#3b82f6' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: i === todayIndex ? 'white' : '#374151',
                  }}
                >
                  {day}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* 시간표 그리드 */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            {/* 시간 라벨 */}
            <View style={{ width: TIME_COL_WIDTH }}>
              {timeLabels.map(label => (
                <View
                  key={label}
                  style={{ height: 60 * MIN_CELL_HEIGHT, alignItems: 'flex-end', paddingRight: 6 }}
                >
                  <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: -6 }}>{label}</Text>
                </View>
              ))}
            </View>

            {/* 요일별 컬럼 */}
            {ALL_DAYS.map((day, dayIndex) => (
              <Animated.View
                key={day}
                style={[colStyles[dayIndex], { height: gridHeight, position: 'relative', borderLeftWidth: 1, borderLeftColor: '#f3f4f6' }]}
              >
                {/* 시간 구분선 */}
                {timeLabels.map((label, i) => (
                  <View
                    key={label}
                    style={{ position: 'absolute', top: i * 60 * MIN_CELL_HEIGHT, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}
                  />
                ))}
                {/* 30분 구분선 */}
                {timeLabels.map((label, i) => (
                  <View
                    key={`h-${label}`}
                    style={{ position: 'absolute', top: i * 60 * MIN_CELL_HEIGHT + 30 * MIN_CELL_HEIGHT, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#fafafa' }}
                  />
                ))}

                {/* 빈 셀 (롱프레스=일정추가, 더블탭=줌) */}
                {timeLabels.slice(0, -1).map((label, i) => {
                  const hour = timeToMinutes(label) / 60;
                  return (
                    <Pressable
                      key={`cell-${label}`}
                      style={{ position: 'absolute', top: i * 60 * MIN_CELL_HEIGHT, height: 60 * MIN_CELL_HEIGHT, left: 0, right: 0 }}
                      onPress={() => handleCellPress(dayIndex)}
                      onLongPress={() => handleCellLongPress(dayIndex, hour)}
                      delayLongPress={400}
                    />
                  );
                })}

                {/* 일정 블록 */}
                {activeTimetable?.schedules
                  .filter(s => s.dayOfWeek.includes(dayIndex))
                  .map(schedule => {
                    const { top, height } = getBlockStyle(schedule);
                    return (
                      <Pressable
                        key={schedule.id}
                        onPress={() => handleSchedulePress(schedule)}
                        style={{
                          position: 'absolute',
                          top,
                          height,
                          left: 1,
                          right: 1,
                          backgroundColor: schedule.color,
                          borderRadius: 4,
                          padding: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '600', color: '#1f2937' }}>
                          {schedule.title}
                        </Text>
                        {schedule.subTitle ? (
                          <Text numberOfLines={1} style={{ fontSize: 9, color: '#4b5563' }}>
                            {schedule.subTitle}
                          </Text>
                        ) : null}
                        {schedule.notification?.enabled ? (
                          <Bell size={8} color="#1f2937" />
                        ) : null}
                      </Pressable>
                    );
                  })}
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
