import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Portal, Modal, Button } from 'react-native-paper';
import { BlurView } from '@react-native-community/blur';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { ChevronDown, Plus, Check, Ellipsis } from 'lucide-react-native';
import ContextMenu from 'react-native-context-menu-view';
import RNPrint from 'react-native-print';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { generateTimetableHtml } from '../utils/printHtml';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getTimetables, saveTimetables } from '../store/timetableStore';
import type { Timetable, Schedule } from '../types';
import { timeToMinutes, minutesToTime } from '../utils/time';
import { syncScheduleNotifications } from '../utils/notification';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
  route: RouteProp<RootStackParamList, 'Main'>;
};

const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIME_COL_WIDTH = 58;
const MIN_CELL_HEIGHT = 1.5; // 10분 = 1.5dp
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
  onDragEnd: (
    scheduleId: string,
    newStartMin: number,
    durationMin: number,
  ) => void;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className="absolute rounded-[4px] overflow-hidden"
        style={[
          {
            top,
            height,
            left: 1,
            right: 1,
            backgroundColor: schedule.color,
          },
          animStyle,
        ]}
      >
        <Animated.View className="p-1" style={stickyLabelStyle}>
          <Text
            numberOfLines={1}
            className="text-[12px] font-bold text-[#1f2937]"
          >
            {schedule.title}
          </Text>
          {schedule.subTitle ? (
            <Text numberOfLines={1} className="text-[9px] text-[#4b5563]">
              {schedule.subTitle}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// ── 공유용 정적 시간표 뷰 (전체 시간표를 이미지로 캡처) ─────────
// A4 비율(210:297)에 맞게 이미지 높이 계산
const A4_RATIO = 297 / 210;
// 그리드 외 고정 높이: 타이틀(45) + 요일 헤더(32) + paddingBottom(16)
const SHARE_OVERHEAD = 93;

function TimetableShareView({ timetable }: { timetable: Timetable }) {
  const ttStart = timetable.timeRangeStart ?? '07:00';
  const ttEnd = timetable.timeRangeEnd ?? '23:00';
  const showWeekends = timetable.showWeekends ?? false;
  const days = showWeekends ? ALL_DAYS : ALL_DAYS.slice(0, 5);
  const startMin = timeToMinutes(ttStart);
  const endMin = timeToMinutes(ttEnd);
  const totalMin = endMin - startMin;
  // A4 비율 전체 높이에서 헤더 영역을 뺀 나머지를 그리드에 할당
  const shareGridHeight = SCREEN_WIDTH * A4_RATIO - SHARE_OVERHEAD;
  const cellH = shareGridHeight / totalMin;
  const gridHeight = shareGridHeight;
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

// ── 인접 시간표 미리보기 (스와이프 전환용) ─────────────────────
const HEADER_CONTENT_HEIGHT = 92; // 타이틀 영역 48px + 요일 헤더 44px

const StaticTimetableGrid = React.memo(
  ({ timetable }: { timetable: Timetable }) => {
    const insets = useSafeAreaInsets();
    const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top;
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
          contentContainerStyle={{ paddingTop: topInset + HEADER_CONTENT_HEIGHT }}
        >
          <View className="flex-row">
            <View className="w-[58px]">
              {labels.map(label => {
                const { ampm, hour } = formatTimeLabel(label);
                return (
                  <View key={label} className="items-end pr-2 h-[90px]">
                    <Text className="text-[10px] text-[#9ca3af] -mt-[6px]">
                      {ampm}{' '}
                      <Text className="text-[14px] font-medium">{hour}</Text>시
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
                    style={{ top: i * 60 * MIN_CELL_HEIGHT }}
                  />
                ))}
                {timetable.schedules
                  .filter(s => s.dayOfWeek.includes(dayIndex))
                  .map(schedule => {
                    const sTop =
                      (timeToMinutes(schedule.startTime) - sMin) *
                      MIN_CELL_HEIGHT;
                    const sH = Math.max(
                      (timeToMinutes(schedule.endTime) -
                        timeToMinutes(schedule.startTime)) *
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
                          backgroundColor: schedule.color,
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
        <HeaderContainer isIos={Platform.OS === 'ios'}>
          <View className="px-4 pb-2" style={{ paddingTop: topInset }}>
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
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    i === today ? 'bg-blue-500' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      i === today
                        ? 'text-white'
                        : i === 5
                          ? 'text-blue-500'
                          : i === 6
                            ? 'text-red-500'
                            : 'text-[#374151]'
                    }`}
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

function HeaderContainer({
  isIos,
  children,
}: {
  isIos: boolean;
  children: React.ReactNode;
}) {
  const style = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  };
  if (isIos) {
    return (
      <BlurView blurType="prominent" blurAmount={20} style={style}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[style, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
      {children}
    </View>
  );
}

function renderBackdrop(
  props: React.ComponentProps<typeof BottomSheetBackdrop>,
) {
  return (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      pressBehavior="close"
    />
  );
}

// ── 메인 화면 ──────────────────────────────────────────────────
export default function MainScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top;
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDraggingSchedule, setIsDraggingSchedule] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [newTimetableName, setNewTimetableName] = useState('');
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  const todayIndex = getTodayIndex();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);
  const viewShotRef = useRef<View>(null);
  const shareViewRef = useRef<View>(null);

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

  // 핀치 줌 스케일 (1.0 ~ 2.0)
  const pinchScale = useSharedValue(1);
  const savedPinchScale = useSharedValue(1);

  // 좌우 팬 오프셋 (줌 상태에서 가로 스크롤)
  const zoomPanOffsetX = useSharedValue(0);
  const savedZoomPanOffsetX = useSharedValue(0);

  // 워크렛에서 numDays 접근용 (JS 변수는 워크렛 내 직접 참조 불가)
  const numDaysShared = useSharedValue(5);

  const colStyle0 = useAnimatedStyle(() => ({ width: colW0.value }));
  const colStyle1 = useAnimatedStyle(() => ({ width: colW1.value }));
  const colStyle2 = useAnimatedStyle(() => ({ width: colW2.value }));
  const colStyle3 = useAnimatedStyle(() => ({ width: colW3.value }));
  const colStyle4 = useAnimatedStyle(() => ({ width: colW4.value }));
  const colStyle5 = useAnimatedStyle(() => ({ width: colW5.value }));
  const colStyle6 = useAnimatedStyle(() => ({ width: colW6.value }));
  const colStyles = [
    colStyle0,
    colStyle1,
    colStyle2,
    colStyle3,
    colStyle4,
    colStyle5,
    colStyle6,
  ];

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // 핀치/팬 제스처로 적용되는 요일 컬럼 컨테이너 translateX
  const columnsContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zoomPanOffsetX.value }],
    flexDirection: 'row' as const,
  }));

  const prevSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - SCREEN_WIDTH }],
  }));

  const nextSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + SCREEN_WIDTH }],
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
    const msToNextMinute =
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
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
    setTimeout(
      () => scrollRef.current?.scrollTo({ y: offset, animated: false }),
      100,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetables.length > 0]); // timetables 첫 로드 시 1회

  // 컬럼 너비 업데이트 (numDays/availableWidth 변경 시 균등 분배)
  // 핀치 줌은 컨테이너 translateX+colW*scale로 처리하므로 여기선 단순 균등 분배만 수행
  useEffect(() => {
    numDaysShared.value = numDays;
    const normalW = availableWidth / numDays;
    for (let i = 0; i < 7; i++) {
      colWs[i].value = withTiming(i < numDays ? normalW : 0, {
        duration: ZOOM_DURATION,
      });
    }
    // numDays 변경 시 줌 상태 리셋
    pinchScale.value = withTiming(1, { duration: ZOOM_DURATION });
    savedPinchScale.value = 1;
    zoomPanOffsetX.value = withTiming(0, { duration: ZOOM_DURATION });
    savedZoomPanOffsetX.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numDays, availableWidth]);

  // 스와이프 전환 중 인접 시간표 데이터를 프리징하여 깜빡임 방지
  const pendingTranslateXReset = useRef(false);
  const frozenAdjacentRef = useRef<{
    prev: Timetable | null;
    next: Timetable | null;
  } | null>(null);

  function handleSwipeAnimationDone(oldIndex: number, newIndex: number) {
    // activeIndex 변경 전에 현재 인접 데이터를 프리징
    // → translateX 리셋 전까지 정적 그리드가 올바른 시간표를 계속 표시
    frozenAdjacentRef.current = {
      prev: oldIndex > 0 ? timetables[oldIndex - 1] : null,
      next: oldIndex < timetables.length - 1 ? timetables[oldIndex + 1] : null,
    };
    pendingTranslateXReset.current = true;
    setActiveIndex(newIndex);
  }

  // useLayoutEffect: React 커밋 직후(화면 페인트 전)에 translateX 리셋
  useLayoutEffect(() => {
    if (pendingTranslateXReset.current) {
      pendingTranslateXReset.current = false;
      translateX.value = 0;
      frozenAdjacentRef.current = null;
    }
  });

  // 인접 시간표: 프리징된 데이터 우선, 없으면 현재 activeIndex 기준
  const prevTimetable =
    frozenAdjacentRef.current?.prev ??
    (activeIndex > 0 ? timetables[activeIndex - 1] : null);
  const nextTimetable =
    frozenAdjacentRef.current?.next ??
    (activeIndex < timetables.length - 1 ? timetables[activeIndex + 1] : null);

  // 타이틀 영역 스와이프 → 시간표 전환
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onChange(e => {
      // 끝에 도달하면 저항감 (rubber-band)
      const canGoLeft = activeIndex < timetables.length - 1;
      const canGoRight = activeIndex > 0;
      if (
        (e.translationX < 0 && !canGoLeft) ||
        (e.translationX > 0 && !canGoRight)
      ) {
        translateX.value = e.translationX * 0.2;
      } else {
        translateX.value = e.translationX;
      }
    })
    .onEnd(e => {
      const isSwipe =
        Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 400;
      if (
        isSwipe &&
        e.translationX < 0 &&
        activeIndex < timetables.length - 1
      ) {
        translateX.value = withTiming(
          -SCREEN_WIDTH,
          { duration: SLIDE_DURATION },
          () => {
            runOnJS(handleSwipeAnimationDone)(activeIndex, activeIndex + 1);
          },
        );
      } else if (isSwipe && e.translationX > 0 && activeIndex > 0) {
        translateX.value = withTiming(
          SCREEN_WIDTH,
          { duration: SLIDE_DURATION },
          () => {
            runOnJS(handleSwipeAnimationDone)(activeIndex, activeIndex - 1);
          },
        );
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  // 핀치 줌 제스처 — 전체 요일 균등 확대 (최대 2배)
  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      const newScale = Math.min(2, Math.max(1, savedPinchScale.value * e.scale));
      pinchScale.value = newScale;
      // 컬럼 너비를 스케일에 맞게 실시간 업데이트
      const normalW = availableWidth / numDaysShared.value;
      for (let i = 0; i < 7; i++) {
        colWs[i].value = i < numDaysShared.value ? normalW * newScale : 0;
      }
      // 팬 오프셋이 범위 초과하면 클램프
      const maxPan = -(availableWidth * (newScale - 1));
      if (zoomPanOffsetX.value < maxPan) {
        zoomPanOffsetX.value = maxPan;
      }
    })
    .onEnd(() => {
      savedPinchScale.value = pinchScale.value;
      // 1.1배 미만이면 원위치로 스냅
      if (pinchScale.value < 1.1) {
        const normalW = availableWidth / numDaysShared.value;
        for (let i = 0; i < 7; i++) {
          colWs[i].value = withTiming(
            i < numDaysShared.value ? normalW : 0,
            { duration: ZOOM_DURATION },
          );
        }
        pinchScale.value = withTiming(1, { duration: ZOOM_DURATION });
        savedPinchScale.value = 1;
        zoomPanOffsetX.value = withTiming(0, { duration: ZOOM_DURATION });
        savedZoomPanOffsetX.value = 0;
      }
    });

  // 수평 팬 제스처 — 줌 상태에서 좌우 이동
  const horizontalPanGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])  // 수평 10px 이상이어야 활성화
    .failOffsetY([-8, 8])      // 수직 8px 먼저 감지 시 실패 → 수직 스크롤로 넘김
    .onUpdate(e => {
      if (pinchScale.value <= 1.01) return; // 줌 상태일 때만 동작
      const maxPan = -(availableWidth * (pinchScale.value - 1));
      zoomPanOffsetX.value = Math.max(
        maxPan,
        Math.min(0, savedZoomPanOffsetX.value + e.translationX),
      );
    })
    .onEnd(() => {
      savedZoomPanOffsetX.value = zoomPanOffsetX.value;
    });

  // 핀치 + 수평 팬을 동시에 처리
  const columnsGesture = Gesture.Simultaneous(pinchGesture, horizontalPanGesture);

  function handleCellLongPress(dayIndex: number, hour: number) {
    triggerHaptic();
    const hh = String(hour).padStart(2, '0');
    navigation.navigate('ScheduleForm', {
      defaultDay: dayIndex,
      defaultStartTime: `${hh}:00`,
      defaultEndTime: `${hh}:50`,
      timetableId: activeTimetable?.id,
    });
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

    const movedSchedule = updatedSchedules.find(s => s.id === scheduleId);
    if (movedSchedule) {
      syncScheduleNotifications(movedSchedule);
    }
  }

  function getBlockStyle(schedule: Schedule) {
    const top =
      (timeToMinutes(schedule.startTime) - startMin) * MIN_CELL_HEIGHT;
    const height = Math.max(
      (timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)) *
        MIN_CELL_HEIGHT,
      MIN_CELL_HEIGHT * 2,
    );
    return { top, height };
  }

  function handleAddTimetable() {
    setNewTimetableName(`시간표 ${timetables.length + 1}`);
    setAddModalVisible(true);
  }

  async function handleContextMenuAction(index: number) {
    if (index === 0) {
      navigation.navigate('Settings', {
        timetableId: activeTimetable?.id ?? '',
      });
    } else if (index === 1) {
      if (!activeTimetable) return;
      const html = generateTimetableHtml(activeTimetable);
      await RNPrint.print({ html });
    } else if (index === 2) {
      if (!activeTimetable || !shareViewRef.current) return;
      try {
        const uri = await captureRef(shareViewRef, {
          format: 'png',
          quality: 1,
          useRenderInContext: Platform.OS === 'ios',
        });
        await Share.open({ url: uri });
      } catch {
        // 사용자가 공유 취소
      }
    }
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
    <View className="flex-1 bg-white" style={{ overflow: 'hidden' }}>
      {/* 인접 시간표: 이전 */}
      {prevTimetable && (
        <Animated.View style={[StyleSheet.absoluteFill, prevSlideStyle]}>
          <StaticTimetableGrid timetable={prevTimetable} />
        </Animated.View>
      )}

      {/* 슬라이드 컨테이너 — ScrollView와 BlurView를 같은 surface에 배치 */}
      <Animated.View style={[{ flex: 1 }, slideStyle]}>
        {/* 시간표 그리드 — contentContainerStyle로 헤더 높이만큼 아래서 시작 */}
        <Animated.ScrollView
          collapsable={false}
          ref={(node: any) => {
            scrollRef.current = node;
            (viewShotRef as any).current = node;
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDraggingSchedule}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: topInset + HEADER_CONTENT_HEIGHT }}
        >
          <View style={{ flexDirection: 'row' }} className="relative">
            {/* 시간 라벨 — 핀치/팬 무관하게 고정 */}
            <View className="relative w-[58px]">
              {/* 현재 시각 배지 — 시간 라벨 우측에 표시 */}
              {nowMin >= startMin && nowMin <= endMin && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: (nowMin - startMin) * MIN_CELL_HEIGHT - 6,
                    right: 4,
                    zIndex: 11,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: '#EF4444',
                      borderRadius: 7,
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                    }}
                  >
                    <Text className="text-[9px] text-white font-medium">
                      {String(Math.floor(nowMin / 60)).padStart(2, '0')}:
                      {String(nowMin % 60).padStart(2, '0')}
                    </Text>
                  </View>
                </View>
              )}
              {timeLabels.map(label => {
                const { ampm, hour } = formatTimeLabel(label);
                return (
                  <View key={label} className="items-end pr-2 h-[90px]">
                    <Text className="text-[10px] text-[#9ca3af] -mt-[6px]">
                      {ampm}{' '}
                      <Text className="text-[14px] font-medium">{hour}</Text>시
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* 요일 컬럼 영역 — 핀치/팬 제스처 적용 */}
            <View style={{ flex: 1, overflow: 'hidden' }}>
              {/* 현재 시간선 — translateX와 함께 이동 */}
              {nowMin >= startMin && nowMin <= endMin && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: (nowMin - startMin) * MIN_CELL_HEIGHT,
                    left: 0,
                    right: 0,
                    height: 0.75,
                    backgroundColor: '#EF4444',
                    zIndex: 10,
                  }}
                />
              )}
              <GestureDetector gesture={columnsGesture}>
                <Animated.View style={columnsContainerStyle}>
                  {ALL_DAYS.map((day, dayIndex) => (
                    <Animated.View
                      key={day}
                      className="relative border-l border-[#f3f4f6] overflow-visible"
                      style={[colStyles[dayIndex], { height: gridHeight }]}
                    >
                      {/* 그리드 인프라 — 클리핑 적용 */}
                      <View className="absolute inset-0 overflow-hidden">
                        {/* 시간 구분선 */}
                        {timeLabels.map((label, i) => (
                          <View
                            key={label}
                            className="absolute left-0 right-0 border-t border-[#f3f4f6]"
                            style={{ top: i * 60 * MIN_CELL_HEIGHT }}
                          />
                        ))}
                        {/* 30분 구분선 */}
                        {timeLabels.map((label, i) => (
                          <View
                            key={`h-${label}`}
                            className="absolute left-0 right-0 border-t border-[#fafafa]"
                            style={{
                              top: i * 60 * MIN_CELL_HEIGHT + 30 * MIN_CELL_HEIGHT,
                            }}
                          />
                        ))}
                        {/* 빈 셀 — 롱프레스로 일정 추가 */}
                        {timeLabels.slice(0, -1).map((label, i) => {
                          const hour = timeToMinutes(label) / 60;
                          return (
                            <Pressable
                              key={`cell-${label}`}
                              className="absolute left-0 right-0"
                              style={{
                                top: i * 60 * MIN_CELL_HEIGHT,
                                height: 60 * MIN_CELL_HEIGHT,
                              }}
                              onLongPress={() => handleCellLongPress(dayIndex, hour)}
                              delayLongPress={400}
                            />
                          );
                        })}
                      </View>

                      {/* 알림 바 — 항상 렌더 (zoomedDay 조건 제거) */}
                      {activeTimetable?.schedules
                        .filter(
                          s =>
                            s.dayOfWeek.includes(dayIndex) &&
                            s.notification?.enabled,
                        )
                        .map(schedule => {
                          const { top } = getBlockStyle(schedule);
                          const minutesBefore =
                            schedule.notification!.minutesBefore;
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

                      {/* 일정 블록 — 항상 렌더 (zoomedDay 조건 제거) */}
                      {activeTimetable?.schedules
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
                </Animated.View>
              </GestureDetector>
            </View>
          </View>
        </Animated.ScrollView>

        {/* 앱 헤더 — ScrollView와 같은 surface에서 absolute로 위에 올려야 blur가 동작 */}
        <HeaderContainer isIos={Platform.OS === 'ios'}>
          <View className="px-4 pb-0" style={{ paddingTop: topInset }}>
            <View className="flex-row items-start justify-between min-h-[40px]">
              {/* 타이틀 + 스와이프 영역 */}
              <GestureDetector gesture={panGesture}>
                <View className="flex-1 py-1">
                  <TouchableOpacity
                    className="flex-row items-center gap-[4px]"
                    onPress={() => bottomSheetRef.current?.expand()}
                    activeOpacity={0.6}
                  >
                    <Text className="text-[18px] font-bold text-[#111827]">
                      {activeTimetable?.name ?? '시간표'}
                    </Text>
                    <ChevronDown size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </GestureDetector>

              {/* 버튼 */}
              <View className="flex-row gap-1 pt-[2px]">
                <TouchableOpacity
                  className="w-8 h-8 items-center justify-center"
                  onPress={handleAddTimetable}
                >
                  <Plus size={20} color="#9ca3af" />
                </TouchableOpacity>
                <View collapsable={false} className="w-8 h-8">
                  <ContextMenu
                    dropdownMenuMode
                    style={{ width: 32, height: 32 }}
                    actions={
                      Platform.OS === 'android'
                        ? [
                            { title: '설정하기', icon: 'ic_settings' },
                            { title: '프린트하기', icon: 'ic_print' },
                            { title: '공유하기', icon: 'ic_share' },
                          ]
                        : [
                            { title: '설정하기', systemIcon: 'gearshape' },
                            { title: '프린트하기', systemIcon: 'printer' },
                            { title: '공유하기', systemIcon: 'square.and.arrow.up' },
                          ]
                    }
                    onPress={e => handleContextMenuAction(e.nativeEvent.index)}
                  >
                    <View className="w-8 h-8 items-center justify-center">
                      <Ellipsis size={18} color="#6b7280" />
                    </View>
                  </ContextMenu>
                </View>
              </View>
            </View>
          </View>

          {/* 요일 헤더 — 바디 컬럼과 동일한 translateX 적용 */}
          <View className="flex-row border-b border-[#e5e7eb] h-[44px]">
            <View className="w-[58px]" />
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <Animated.View style={columnsContainerStyle}>
                {ALL_DAYS.map((day, i) => {
                  const headerVisible = i < numDays;
                  return (
                    <Animated.View
                      key={day}
                      className="items-center justify-center overflow-hidden"
                      style={colStyles[i]}
                    >
                      {headerVisible && (
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            i === todayIndex ? 'bg-blue-500' : 'bg-transparent'
                          }`}
                        >
                          <Text
                            className={`text-[13px] font-semibold ${
                              i === todayIndex
                                ? 'text-white'
                                : i === 5
                                  ? 'text-blue-500'
                                  : i === 6
                                    ? 'text-red-500'
                                    : 'text-[#374151]'
                            }`}
                          >
                            {day}
                          </Text>
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
              </Animated.View>
            </View>
          </View>
        </HeaderContainer>
      </Animated.View>

      {/* 인접 시간표: 다음 */}
      {nextTimetable && (
        <Animated.View style={[StyleSheet.absoluteFill, nextSlideStyle]}>
          <StaticTimetableGrid timetable={nextTimetable} />
        </Animated.View>
      )}

      {/* 시간표 선택 바텀시트 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView>
          <Text className="text-[15px] font-semibold text-[#1C1C1E] px-5 pb-3 pt-1">
            시간표 선택
          </Text>
          {timetables.map((tt, i) => (
            <TouchableOpacity
              key={tt.id}
              className="flex-row items-center px-5 py-3"
              onPress={() => {
                if (i !== activeIndex) {
                  const direction = i > activeIndex ? -1 : 1;
                  translateX.value = -direction * SCREEN_WIDTH;
                  setActiveIndex(i);
                  translateX.value = withTiming(0, {
                    duration: SLIDE_DURATION,
                  });
                }
                bottomSheetRef.current?.close();
              }}
              activeOpacity={0.6}
            >
              <Text
                className={`flex-1 text-[16px] ${
                  i === activeIndex
                    ? 'font-semibold text-[#3b82f6]'
                    : 'text-[#1C1C1E]'
                }`}
              >
                {tt.name}
              </Text>
              {i === activeIndex && <Check size={18} color="#3b82f6" />}
            </TouchableOpacity>
          ))}
          <View className="h-8" />
        </BottomSheetView>
      </BottomSheet>

      {/* 공유용 오프스크린 시간표 뷰 */}
      {activeTimetable && (
        <View
          ref={shareViewRef}
          collapsable={false}
          pointerEvents="none"
          style={{ position: 'absolute', left: SCREEN_WIDTH * 2, top: 0 }}
        >
          <TimetableShareView timetable={activeTimetable} />
        </View>
      )}

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
          <Text className="text-[17px] font-semibold text-[#1C1C1E] mb-4">
            새 시간표
          </Text>
          <TextInput
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '#E5E5EA',
            }}
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
            <Button
              onPress={() => setAddModalVisible(false)}
              textColor="#6b7280"
            >
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
