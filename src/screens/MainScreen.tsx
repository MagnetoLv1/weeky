import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Portal, Modal, Button } from 'react-native-paper';
import { ChevronLeft, ChevronRight, Plus, Settings as SettingsIcon } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getTimetables, saveTimetables } from '../store/timetableStore';
import type { Timetable, Schedule } from '../types';
import { timeToMinutes, minutesToTime } from '../utils/time';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
  route: RouteProp<RootStackParamList, 'Main'>;
};

const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_COL_WIDTH = 58;
const MIN_CELL_HEIGHT = 1.5; // 10분 = 1.5dp
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

function formatTimeLabel(label: string): { ampm: string; hour: number } {
  const h = parseInt(label.split(':')[0], 10);
  if (h === 0) return { ampm: '오전', hour: 12 };
  if (h === 12) return { ampm: '오후', hour: 12 };
  if (h < 12) return { ampm: '오전', hour: h };
  return { ampm: '오후', hour: h - 12 };
}

function triggerHaptic() {
  ReactNativeHapticFeedback.trigger('impactMedium', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
}

// ── 드래그 가능한 일정 블록 ──────────────────────────────────────
type DraggableBlockProps = {
  schedule: Schedule;
  top: number;
  height: number;
  startMin: number;
  endMin: number;
  scrollY: SharedValue<number>;
  onPress: () => void;
  onDragStart: () => void;
  onDragEnd: (scheduleId: string, newStartMin: number, durationMin: number) => void;
};

function DraggableScheduleBlock({
  schedule,
  top,
  height,
  startMin,
  endMin,
  scrollY,
  onPress,
  onDragStart,
  onDragEnd,
}: DraggableBlockProps) {
  const isDragging = useSharedValue(false);
  const offsetY = useSharedValue(0);
  const prevTop = useRef(top);

  // top prop이 변경되면(드래그 후 데이터 업데이트) offsetY를 리셋
  // → 시각적 위치 = new_top + 0 = old_top + snappedDelta (깜빡임 없음)
  useEffect(() => {
    if (prevTop.current !== top) {
      prevTop.current = top;
      offsetY.value = 0;
    }
  }, [top]);

  const durationMin =
    timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);
  const totalMinutes = endMin - startMin;

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((_, success) => {
      if (success) runOnJS(onPress)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(400)
    .onStart(() => {
      isDragging.value = true;
      runOnJS(triggerHaptic)();
      runOnJS(onDragStart)();
    });

  const pan = Gesture.Pan()
    .onChange(e => {
      if (!isDragging.value) return;
      const minOffset = -top;
      const maxOffset = (totalMinutes - durationMin) * MIN_CELL_HEIGHT - top;
      offsetY.value = Math.max(minOffset, Math.min(maxOffset, e.translationY));
    })
    .onFinalize(() => {
      if (!isDragging.value) return;
      const rawTop = top + offsetY.value;
      const clampedMinutes = Math.min(
        Math.round(Math.max(0, rawTop) / MIN_CELL_HEIGHT / 10) * 10,
        totalMinutes - durationMin,
      );
      const newStartMin = startMin + clampedMinutes;
      isDragging.value = false;
      // offsetY를 스냅 위치로 유지 (top이 업데이트되면 useEffect에서 0으로 리셋)
      offsetY.value = clampedMinutes * MIN_CELL_HEIGHT - top;
      runOnJS(onDragEnd)(schedule.id, newStartMin, durationMin);
    });

  const composed = Gesture.Race(tap, Gesture.Simultaneous(longPress, pan));

  const LABEL_H = 34;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
    opacity: isDragging.value ? 0.8 : 1,
    zIndex: isDragging.value ? 999 : 1,
    shadowOpacity: isDragging.value ? 0.3 : 0,
    shadowRadius: isDragging.value ? 8 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: isDragging.value ? 4 : 0 },
    elevation: isDragging.value ? 8 : 0,
  }));

  const stickyLabelStyle = useAnimatedStyle(() => {
    const stickyOffset = Math.max(
      0,
      Math.min(scrollY.value - (top + offsetY.value), height - LABEL_H),
    );
    return { transform: [{ translateY: stickyOffset }] };
  });

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top,
            height,
            left: 1,
            right: 1,
            backgroundColor: schedule.color,
            borderRadius: 4,
            overflow: 'hidden',
          },
          animStyle,
        ]}
      >
        <Animated.View style={[{ padding: 4 }, stickyLabelStyle]}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#1f2937' }}>
            {schedule.title}
          </Text>
          {schedule.subTitle ? (
            <Text numberOfLines={1} style={{ fontSize: 9, color: '#4b5563' }}>
              {schedule.subTitle}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── 메인 화면 ──────────────────────────────────────────────────
export default function MainScreen({ navigation, route }: Props) {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomedDay, setZoomedDay] = useState<number | null>(null);
  const [isDraggingSchedule, setIsDraggingSchedule] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTimetableName, setNewTimetableName] = useState('');
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  const todayIndex = getTodayIndex();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);

  // 슬라이드 전환 애니메이션
  const translateX = useSharedValue(0);

  // 스크롤 위치 (sticky 라벨용)
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  // 7개 요일 컬럼 너비 (ALL_DAYS 인덱스 기준)
  const colW0 = useSharedValue(0);
  const colW1 = useSharedValue(0);
  const colW2 = useSharedValue(0);
  const colW3 = useSharedValue(0);
  const colW4 = useSharedValue(0);
  const colW5 = useSharedValue(0);
  const colW6 = useSharedValue(0);
  const colWs = [colW0, colW1, colW2, colW3, colW4, colW5, colW6];

  const colStyle0 = useAnimatedStyle(() => ({ width: colW0.value }));
  const colStyle1 = useAnimatedStyle(() => ({ width: colW1.value }));
  const colStyle2 = useAnimatedStyle(() => ({ width: colW2.value }));
  const colStyle3 = useAnimatedStyle(() => ({ width: colW3.value }));
  const colStyle4 = useAnimatedStyle(() => ({ width: colW4.value }));
  const colStyle5 = useAnimatedStyle(() => ({ width: colW5.value }));
  const colStyle6 = useAnimatedStyle(() => ({ width: colW6.value }));
  const colStyles = [colStyle0, colStyle1, colStyle2, colStyle3, colStyle4, colStyle5, colStyle6];

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      setTimetables(getTimetables());
      const idx = route.params?.activeIndex;
      if (idx !== undefined) {
        setActiveIndex(idx);
      }
    }, [route.params?.activeIndex]),
  );

  const activeTimetable = timetables[activeIndex];
  const ttStart = activeTimetable?.timeRangeStart ?? '07:00';
  const ttEnd = activeTimetable?.timeRangeEnd ?? '23:00';
  const ttShowWeekends = activeTimetable?.showWeekends ?? false;
  const days = ttShowWeekends ? ALL_DAYS : ALL_DAYS.slice(0, 5);
  const numDays = days.length;
  const timeLabels = generateTimeLabels(ttStart, ttEnd);
  const startMin = timeToMinutes(ttStart);
  const endMin = timeToMinutes(ttEnd);
  const gridHeight = (endMin - startMin) * MIN_CELL_HEIGHT;
  const availableWidth = SCREEN_WIDTH - TIME_COL_WIDTH;

  // 현재 시간 — 정각 분 단위에 맞춰 업데이트
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    // 다음 분 정각까지 남은 ms
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  // 초기 스크롤: 현재 시간이 화면 중앙에 오도록
  useEffect(() => {
    if (timetables.length === 0) return;
    const nowTop = (nowMin - startMin) * MIN_CELL_HEIGHT;
    const { height: screenH } = Dimensions.get('window');
    const offset = Math.max(0, nowTop - screenH / 2);
    setTimeout(() => scrollRef.current?.scrollTo({ y: offset, animated: false }), 100);
  }, [timetables.length > 0]);  // timetables 첫 로드 시 1회

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
        w = availableWidth * 0.6; // 줌된 요일: 60%
      } else if (Math.abs(i - zoomedDay) === 1) {
        w = availableWidth * 0.2; // 인접 요일: 20%
      } else {
        w = 0; // 나머지 요일: 밀림
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

  function handleScheduleDragEnd(
    scheduleId: string,
    newStartMin: number,
    durationMin: number,
  ) {
    setIsDraggingSchedule(false);
    if (!activeTimetable) return;
    const newStartTime = minutesToTime(newStartMin);
    const newEndTime = minutesToTime(newStartMin + durationMin);
    const updatedSchedules = activeTimetable.schedules.map(s =>
      s.id === scheduleId
        ? { ...s, startTime: newStartTime, endTime: newEndTime }
        : s,
    );
    const updatedTimetables = timetables.map((tt, i) =>
      i === activeIndex ? { ...tt, schedules: updatedSchedules } : tt,
    );
    saveTimetables(updatedTimetables);
    setTimetables(updatedTimetables);
    triggerHaptic();
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
    setNewTimetableName(`시간표 ${timetables.length + 1}`);
    setAddModalVisible(true);
  }

  function confirmAddTimetable() {
    const name = newTimetableName.trim();
    if (!name) return;
    const newTt: Timetable = {
      id: Date.now().toString(),
      name,
      order: timetables.length,
      schedules: [],
    };
    const updated = [...timetables, newTt];
    saveTimetables(updated);
    setTimetables(updated);
    setAddModalVisible(false);
    translateX.value = SCREEN_WIDTH;
    setActiveIndex(updated.length - 1);
    translateX.value = withTiming(0, { duration: SLIDE_DURATION });
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* 앱 헤더 (고정) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 40 }}>
          {/* 타이틀 + 스와이프 영역 */}
          <GestureDetector gesture={panGesture}>
            <View style={{ flex: 1, paddingVertical: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ChevronLeft size={16} color={activeIndex > 0 ? '#9ca3af' : 'transparent'} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                  {activeTimetable?.name ?? '시간표'}
                </Text>
                <ChevronRight size={16} color={activeIndex < timetables.length - 1 ? '#9ca3af' : 'transparent'} />
              </View>
              <View style={{ flexDirection: 'row', gap: 3, marginTop: 6, marginLeft: 22, height: 4 }}>
                {timetables.length > 1 && timetables.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      borderRadius: 99,
                      width: i === activeIndex ? 10 : 4,
                      height: 4,
                      backgroundColor: i === activeIndex ? '#3b82f6' : '#d1d5db',
                    }}
                  />
                ))}
              </View>
            </View>
          </GestureDetector>

          {/* 버튼 */}
          <View style={{ flexDirection: 'row', gap: 4, paddingTop: 2 }}>
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
              onPress={() => navigation.navigate('Settings', { timetableId: activeTimetable?.id ?? '' })}
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
          {ALL_DAYS.map((day, i) => {
            const headerVisible = i < numDays && (zoomedDay === null || Math.abs(i - zoomedDay) <= 1);
            return (
              <Animated.View
                key={day}
                style={[colStyles[i], { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}
              >
                {headerVisible && (
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
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* 시간표 그리드 */}
        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDraggingSchedule}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <View style={{ flexDirection: 'row', position: 'relative' }}>
            {/* 현재 시간선 — 전체 너비 */}
            {nowMin >= startMin && nowMin <= endMin && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: (nowMin - startMin) * MIN_CELL_HEIGHT,
                  left: TIME_COL_WIDTH,
                  right: 0,
                  height: 0.75,
                  backgroundColor: '#EF4444',
                  zIndex: 10,
                }}
              >
                <View style={{
                  position: 'absolute',
                  left: -2,
                  top: -1.75,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#EF4444',
                }} />
              </View>
            )}
            {/* 시간 라벨 */}
            <View style={{ width: TIME_COL_WIDTH, position: 'relative' }}>
              {timeLabels.map(label => {
                const { ampm, hour } = formatTimeLabel(label);
                return (
                  <View
                    key={label}
                    style={{ height: 60 * MIN_CELL_HEIGHT, alignItems: 'flex-end', paddingRight: 8 }}
                  >
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: -6 }}>
                      {ampm} <Text style={{ fontSize: 14, fontWeight: '500' }}>{hour}</Text>시
                    </Text>
                  </View>
                );
              })}
              {/* 현재 분 표시 */}
              {nowMin >= startMin && nowMin <= endMin && (
                <View style={{
                  position: 'absolute',
                  top: (nowMin - startMin) * MIN_CELL_HEIGHT - 6,
                  right: 6,
                }}>
                  <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: '400' }}>
                    {String(nowMin % 60).padStart(2, '0')}
                  </Text>
                </View>
              )}
            </View>

            {/* 요일별 컬럼 */}
            {ALL_DAYS.map((day, dayIndex) => (
              <Animated.View
                key={day}
                style={[colStyles[dayIndex], { height: gridHeight, position: 'relative', borderLeftWidth: 1, borderLeftColor: '#f3f4f6', overflow: 'visible' }]}
              >
                {/* 그리드 인프라 — 클리핑 적용 */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
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
                </View>

                {/* 알림 바 — 블록 시작 N분 전 위치에 독립 렌더링 */}
                {(zoomedDay === null || Math.abs(dayIndex - zoomedDay) <= 1) &&
                  activeTimetable?.schedules
                  .filter(s => s.dayOfWeek.includes(dayIndex) && s.notification?.enabled)
                  .map(schedule => {
                    const { top } = getBlockStyle(schedule);
                    const minutesBefore = schedule.notification!.minutesBefore;
                    const barTop = top - minutesBefore * MIN_CELL_HEIGHT;
                    if (barTop < 0) return null;
                    return (
                      <View
                        key={`notif-${schedule.id}`}
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          top: barTop,
                          left: 1,
                          right: 1,
                          height: 2,
                          backgroundColor: '#FACC15',
                          borderRadius: 1,
                          zIndex: 5,
                        }}
                      />
                    );
                  })}

                {/* 일정 블록 */}
                {(zoomedDay === null || Math.abs(dayIndex - zoomedDay) <= 1) &&
                  activeTimetable?.schedules
                  .filter(s => s.dayOfWeek.includes(dayIndex))
                  .map(schedule => {
                    const { top, height } = getBlockStyle(schedule);
                    return (
                      <DraggableScheduleBlock
                        key={schedule.id}
                        schedule={schedule}
                        top={top}
                        height={height}
                        startMin={startMin}
                        endMin={endMin}
                        scrollY={scrollY}
                        onPress={() => handleSchedulePress(schedule)}
                        onDragStart={() => setIsDraggingSchedule(true)}
                        onDragEnd={handleScheduleDragEnd}
                      />
                    );
                  })}
              </Animated.View>
            ))}
          </View>
        </Animated.ScrollView>
      </Animated.View>

      {/* 시간표 추가 모달 */}
      <Portal>
        <Modal
          visible={addModalVisible}
          onDismiss={() => setAddModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: '#fff',
            marginHorizontal: 32,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <Text className="text-[17px] font-semibold text-[#1C1C1E] mb-4">새 시간표</Text>
          <TextInput
            style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E5EA' }}
            className="rounded-lg px-3 py-[10px] text-[16px] text-[#1C1C1E] bg-[#F2F2F7]"
            value={newTimetableName}
            onChangeText={setNewTimetableName}
            placeholder="시간표 이름"
            placeholderTextColor="#C7C7CC"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={confirmAddTimetable}
            returnKeyType="done"
          />
          <View className="flex-row justify-end gap-2 mt-4">
            <Button onPress={() => setAddModalVisible(false)} textColor="#6b7280">
              취소
            </Button>
            <Button mode="contained" onPress={confirmAddTimetable}>
              추가
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}
