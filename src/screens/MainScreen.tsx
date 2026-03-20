import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { cn } from '@/utils/cn';
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
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { ChevronDown, Plus, Check, Ellipsis } from 'lucide-react-native';
import ContextMenu from 'react-native-context-menu-view';
import RNPrint from 'react-native-print';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { generateTimetableHtml } from '@/utils/printHtml';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { getTimetables, saveTimetables } from '@/store/timetableStore';
import { getHolidays, saveHolidays, hasHolidaysForYear } from '@/store/holidayStore';
import { fetchHolidaysForYear } from '@/utils/holidayApi';
import type { Timetable, Schedule } from '@/types';
import { timeToMinutes, minutesToTime } from '@/utils/time';
import { syncScheduleNotifications } from '@/utils/notification';
import {
    ALL_DAYS,
    TIME_COL_WIDTH,
    MIN_CELL_HEIGHT,
    SCREEN_WIDTH,
    ZOOM_DURATION,
    HEADER_CONTENT_HEIGHT,
    getTodayIndex,
    generateTimeLabels,
    formatTimeLabel,
    triggerHaptic,
} from '@/components/timetable/constants';
import { HeaderContainer } from '@/components/timetable/HeaderContainer';
import { renderBackdrop } from '@/components/timetable/renderBackdrop';
import { DraggableScheduleBlock } from '@/components/timetable/DraggableScheduleBlock';
import { TimetableShareView } from '@/components/timetable/TimetableShareView';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
    route: RouteProp<RootStackParamList, 'Main'>;
};

// ── 메인 화면 ──────────────────────────────────────────────────
export default function MainScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const topInset =
        Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : insets.top;
    const [timetables, setTimetables] = useState<Timetable[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDraggingSchedule, setIsDraggingSchedule] = useState(false);
    // 공휴일 날짜 집합 — "YYYYMMDD" 형식 문자열
    const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
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

    // 핀치/팬 제스처로 적용되는 요일 컬럼 컨테이너 translateX
    const columnsContainerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: zoomPanOffsetX.value }],
        flexDirection: 'row' as const,
    }));

    useFocusEffect(
        useCallback(() => {
            const loaded = getTimetables();
            setTimetables(loaded);
            const idx = route.params?.activeIndex;
            if (idx !== undefined) {
                setActiveIndex(idx);
            }

            // 공휴일 연동: MMKV 캐시 로드 및 미보유 시 백그라운드 다운로드
            const active = loaded[idx ?? 0] ?? loaded[0];
            if (active?.holidaySync) {
                const year = new Date().getFullYear();
                const stored = getHolidays(year);
                setHolidayDates(new Set(stored.map(h => h.date)));

                if (!hasHolidaysForYear(year)) {
                    fetchHolidaysForYear(year)
                        .then(holidays => {
                            saveHolidays(year, holidays);
                            setHolidayDates(new Set(holidays.map(h => h.date)));
                        })
                        .catch(() => {}); // 실패 무시 (백그라운드)
                }
            } else {
                setHolidayDates(new Set());
            }
        }, [route.params?.activeIndex]),
    );

    const activeTimetable = timetables[activeIndex];
    const ttStart = activeTimetable?.timeRangeStart ?? '07:00';
    const ttEnd = activeTimetable?.timeRangeEnd ?? '23:00';
    const ttShowWeekends = activeTimetable?.showWeekends ?? false;
    const ttHolidaySync = activeTimetable?.holidaySync ?? false;

    /**
     * 현재 주의 dayIndex(0=월)에 해당하는 날짜를 "YYYYMMDD" 형식으로 반환
     * todayIndex 기준으로 offset 계산
     */
    function getWeekDate(dayIndex: number): string {
        const today = new Date();
        const diff = dayIndex - todayIndex;
        const d = new Date(today);
        d.setDate(today.getDate() + diff);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }
    // 오늘이 공휴일인지 여부 (현재 시간 라인/배지 색상에 사용)
    const isTodayHoliday =
        ttHolidaySync && holidayDates.has(getWeekDate(todayIndex));
    const nowLineColor = isTodayHoliday ? '#d1d5db' : '#EF4444';
    // 주말 표시 OFF이고 오늘이 토/일이면 현재 시간 표시 숨김
    const showNowIndicator = ttShowWeekends || todayIndex < 5;

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
            (60 - new Date().getSeconds()) * 1000 -
            new Date().getMilliseconds();
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

    // 핀치 줌 제스처 — 전체 요일 균등 확대 (최대 2배)
    const pinchGesture = Gesture.Pinch()
        .onUpdate(e => {
            const newScale = Math.min(
                2,
                Math.max(1, savedPinchScale.value * e.scale),
            );
            pinchScale.value = newScale;
            // 컬럼 너비를 스케일에 맞게 실시간 업데이트
            const normalW = availableWidth / numDaysShared.value;
            for (let i = 0; i < 7; i++) {
                colWs[i].value =
                    i < numDaysShared.value ? normalW * newScale : 0;
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
                zoomPanOffsetX.value = withTiming(0, {
                    duration: ZOOM_DURATION,
                });
                savedZoomPanOffsetX.value = 0;
            }
        });

    // 수평 팬 제스처 — 줌 상태에서 좌우 이동
    const horizontalPanGesture = Gesture.Pan()
        .activeOffsetX([-10, 10]) // 수평 10px 이상이어야 활성화
        .failOffsetY([-8, 8]) // 수직 8px 먼저 감지 시 실패 → 수직 스크롤로 넘김
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
    const columnsGesture = Gesture.Simultaneous(
        pinchGesture,
        horizontalPanGesture,
    );

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
            (timeToMinutes(schedule.endTime) -
                timeToMinutes(schedule.startTime)) *
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
        setActiveIndex(updated.length - 1);
    }

    return (
        <View className="flex-1 bg-white" style={{ overflow: 'hidden' }}>
            <View className="flex-1">
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
                    contentContainerStyle={{
                        paddingTop: topInset + HEADER_CONTENT_HEIGHT,
                    }}
                >
                    <View style={{ flexDirection: 'row' }} className="relative">
                        {/* 시간 라벨 — 핀치/팬 무관하게 고정 */}
                        <View className="relative w-[58px]">
                            {/* 현재 시각 배지 — 시간 라벨 우측에 표시 */}
                            {showNowIndicator && nowMin >= startMin && nowMin <= endMin && (
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        top:
                                            (nowMin - startMin) *
                                                MIN_CELL_HEIGHT -
                                            6,
                                        right: 4,
                                        zIndex: 11,
                                    }}
                                >
                                    <View
                                        style={{
                                            backgroundColor: nowLineColor,
                                            borderRadius: 7,
                                            paddingHorizontal: 4,
                                            paddingVertical: 1,
                                        }}
                                    >
                                        <Text className="text-[9px] text-white font-medium">
                                            {String(
                                                Math.floor(nowMin / 60),
                                            ).padStart(2, '0')}
                                            :
                                            {String(nowMin % 60).padStart(
                                                2,
                                                '0',
                                            )}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            {timeLabels.map(label => {
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

                        {/* 요일 컬럼 영역 — 핀치/팬 제스처 적용 */}
                        <View style={{ flex: 1, overflow: 'hidden' }}>
                            {/* 현재 시간선 — translateX와 함께 이동 */}
                            {showNowIndicator && nowMin >= startMin && nowMin <= endMin && (
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        top:
                                            (nowMin - startMin) *
                                            MIN_CELL_HEIGHT,
                                        left: 0,
                                        right: 0,
                                        height: 0.75,
                                        backgroundColor: nowLineColor,
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
                                            style={[
                                                colStyles[dayIndex],
                                                { height: gridHeight },
                                            ]}
                                        >
                                            {/* 그리드 인프라 — 클리핑 적용 */}
                                            <View className="absolute inset-0 overflow-hidden">
                                                {/* 시간 구분선 */}
                                                {timeLabels.map((label, i) => (
                                                    <View
                                                        key={label}
                                                        className="absolute left-0 right-0 border-t border-[#f3f4f6]"
                                                        style={{
                                                            top:
                                                                i *
                                                                60 *
                                                                MIN_CELL_HEIGHT,
                                                        }}
                                                    />
                                                ))}
                                                {/* 30분 구분선 */}
                                                {timeLabels.map((label, i) => (
                                                    <View
                                                        key={`h-${label}`}
                                                        className="absolute left-0 right-0 border-t border-[#fafafa]"
                                                        style={{
                                                            top:
                                                                i *
                                                                    60 *
                                                                    MIN_CELL_HEIGHT +
                                                                30 *
                                                                    MIN_CELL_HEIGHT,
                                                        }}
                                                    />
                                                ))}
                                                {/* 빈 셀 — 롱프레스로 일정 추가 */}
                                                {timeLabels
                                                    .slice(0, -1)
                                                    .map((label, i) => {
                                                        const hour =
                                                            timeToMinutes(
                                                                label,
                                                            ) / 60;
                                                        return (
                                                            <Pressable
                                                                key={`cell-${label}`}
                                                                className="absolute left-0 right-0"
                                                                style={{
                                                                    top:
                                                                        i *
                                                                        60 *
                                                                        MIN_CELL_HEIGHT,
                                                                    height:
                                                                        60 *
                                                                        MIN_CELL_HEIGHT,
                                                                }}
                                                                onLongPress={() =>
                                                                    handleCellLongPress(
                                                                        dayIndex,
                                                                        hour,
                                                                    )
                                                                }
                                                                delayLongPress={
                                                                    400
                                                                }
                                                            />
                                                        );
                                                    })}
                                            </View>

                                            {/* 알림 바 — 항상 렌더 (zoomedDay 조건 제거) */}
                                            {activeTimetable?.schedules
                                                .filter(
                                                    s =>
                                                        s.dayOfWeek.includes(
                                                            dayIndex,
                                                        ) &&
                                                        s.notification?.enabled,
                                                )
                                                .map(schedule => {
                                                    const { top } =
                                                        getBlockStyle(schedule);
                                                    const minutesBefore =
                                                        schedule.notification!
                                                            .minutesBefore;
                                                    const barTop =
                                                        top -
                                                        minutesBefore *
                                                            MIN_CELL_HEIGHT;
                                                    if (barTop < 0) return null;
                                                    return (
                                                        <View
                                                            key={`notif-${schedule.id}`}
                                                            pointerEvents="none"
                                                            style={{
                                                                position:
                                                                    'absolute',
                                                                top: barTop,
                                                                left: 1,
                                                                right: 1,
                                                                height: 2,
                                                                backgroundColor:
                                                                    '#FACC15',
                                                                borderRadius: 1,
                                                                zIndex: 5,
                                                            }}
                                                        />
                                                    );
                                                })}

                                            {/* 일정 블록 — 항상 렌더 (zoomedDay 조건 제거) */}
                                            {activeTimetable?.schedules
                                                .filter(s =>
                                                    s.dayOfWeek.includes(
                                                        dayIndex,
                                                    ),
                                                )
                                                .map(schedule => {
                                                    const { top, height } =
                                                        getBlockStyle(schedule);
                                                    return (
                                                        <DraggableScheduleBlock
                                                            key={schedule.id}
                                                            schedule={schedule}
                                                            top={top}
                                                            height={height}
                                                            startMin={startMin}
                                                            endMin={endMin}
                                                            scrollY={scrollY}
                                                            onPress={() =>
                                                                handleSchedulePress(
                                                                    schedule,
                                                                )
                                                            }
                                                            onDragStart={() =>
                                                                setIsDraggingSchedule(
                                                                    true,
                                                                )
                                                            }
                                                            onDragEnd={
                                                                handleScheduleDragEnd
                                                            }
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
                <HeaderContainer>
                    <View
                        className="px-4 pb-0"
                        style={{ paddingTop: topInset }}
                    >
                        <View className="flex-row items-start justify-between min-h-[40px]">
                            {/* 타이틀 영역 */}
                            <View className="flex-1 py-1">
                                <TouchableOpacity
                                    className="flex-row items-center gap-[4px]"
                                    onPress={() =>
                                        bottomSheetRef.current?.expand()
                                    }
                                    activeOpacity={0.6}
                                >
                                    <Text className="text-[18px] font-bold text-[#111827]">
                                        {activeTimetable?.name ?? '시간표'}
                                    </Text>
                                    <ChevronDown
                                        size={16}
                                        color="#9ca3af"
                                    />
                                </TouchableOpacity>
                            </View>

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
                                                      {
                                                          title: '설정하기',
                                                          icon: 'ic_settings',
                                                      },
                                                      {
                                                          title: '프린트하기',
                                                          icon: 'ic_print',
                                                      },
                                                      {
                                                          title: '공유하기',
                                                          icon: 'ic_share',
                                                      },
                                                  ]
                                                : [
                                                      {
                                                          title: '설정하기',
                                                          systemIcon:
                                                              'gearshape',
                                                      },
                                                      {
                                                          title: '프린트하기',
                                                          systemIcon: 'printer',
                                                      },
                                                      {
                                                          title: '공유하기',
                                                          systemIcon:
                                                              'square.and.arrow.up',
                                                      },
                                                  ]
                                        }
                                        onPress={e =>
                                            handleContextMenuAction(
                                                e.nativeEvent.index,
                                            )
                                        }
                                    >
                                        <View className="w-8 h-8 items-center justify-center">
                                            <Ellipsis
                                                size={18}
                                                color="#6b7280"
                                            />
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
                                                (() => {
                                                    const isToday = i === todayIndex;
                                                    const isHoliday =
                                                        ttHolidaySync &&
                                                        holidayDates.has(
                                                            getWeekDate(i),
                                                        );
                                                    return (
                                                        <View
                                                            className={cn(
                                                                'w-8 h-8 items-center justify-center',
                                                                isHoliday
                                                                    ? 'rounded bg-red-100'
                                                                    : isToday
                                                                    ? 'rounded-full bg-blue-500'
                                                                    : '',
                                                            )}
                                                        >
                                                            <Text
                                                                className={cn(
                                                                    'text-[13px] font-semibold',
                                                                    isHoliday
                                                                        ? 'text-red-500'
                                                                        : isToday
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
                                                    );
                                                })()
                                            )}
                                        </Animated.View>
                                    );
                                })}
                            </Animated.View>
                        </View>
                    </View>
                </HeaderContainer>
            </View>

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
                                    setActiveIndex(i);
                                }
                                bottomSheetRef.current?.close();
                            }}
                            activeOpacity={0.6}
                        >
                            <Text
                                className={cn(
                                    'flex-1 text-[16px]',
                                    i === activeIndex
                                        ? 'font-semibold text-[#3b82f6]'
                                        : 'text-[#1C1C1E]',
                                )}
                            >
                                {tt.name}
                            </Text>
                            {i === activeIndex && (
                                <Check size={18} color="#3b82f6" />
                            )}
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
                    style={{
                        position: 'absolute',
                        left: SCREEN_WIDTH * 2,
                        top: 0,
                    }}
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
