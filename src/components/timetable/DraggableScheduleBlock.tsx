// 드래그 가능한 일정 블록 (Reanimated + GestureHandler 기반)
import React, { useEffect, useMemo, useRef } from 'react';
import { Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
    type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Schedule } from '@/types';
import { MIN_CELL_HEIGHT, triggerHaptic } from './constants';
import { timeToMinutes } from '@/utils/time';

export type DraggableBlockProps = {
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

export function DraggableScheduleBlock({
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

    // 드래그 애니메이션 중 매 프레임마다 재파싱되지 않도록 메모이제이션
    const durationMin = useMemo(
        () =>
            timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime),
        [schedule.endTime, schedule.startTime],
    );
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
            const maxOffset =
                (totalMinutes - durationMin) * MIN_CELL_HEIGHT - top;
            offsetY.value = Math.max(
                minOffset,
                Math.min(maxOffset, e.translationY),
            );
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

    // 스크롤 시 라벨이 블록 상단에 고정되도록 sticky 효과
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
                className="absolute rounded overflow-hidden"
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
                        className="text-xs font-bold text-[#1f2937]"
                    >
                        {schedule.title}
                    </Text>
                    {schedule.subTitle ? (
                        <Text
                            numberOfLines={1}
                            className="text-[9px] text-[#4b5563]"
                        >
                            {schedule.subTitle}
                        </Text>
                    ) : null}
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}
