import { cn } from '@/utils/cn';
import {
    LiquidGlassView,
    isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { BlurView } from '@react-native-community/blur';
import { cssInterop } from 'nativewind';
import React from 'react';
import {
    Platform,
    TouchableOpacity,
    TouchableOpacityProps,
    View,
} from 'react-native';

// className prop을 지원하지 않는 네이티브 컴포넌트를 NativeWind와 연결
cssInterop(LiquidGlassView, { className: 'style' });
cssInterop(BlurView, { className: 'style' });

// Platform.OS는 런타임 불변값 — 모듈 레벨에서 한 번만 평가
const IS_IOS = Platform.OS === 'ios';
const USE_LIQUID_GLASS = IS_IOS && isLiquidGlassSupported;

type Props = {
    children: React.ReactNode;
    className?: string;
};

// 플랫폼별 glass 비주얼 렌더링 헬퍼
// iOS + LiquidGlass지원 → LiquidGlassView / iOS폴백 → BlurView / Android → 반투명 View
function GlassVisual({ children, className }: Props) {
    if (USE_LIQUID_GLASS) {
        return (
            <LiquidGlassView interactive effect="regular" className={className}>
                {children}
            </LiquidGlassView>
        );
    }
    if (IS_IOS) {
        return (
            <BlurView blurType="ultraThinMaterial" blurAmount={20} className={className}>
                {children}
            </BlurView>
        );
    }
    return <View className={cn('bg-black/10', className)}>{children}</View>;
}

// 원형 glass 버튼 — onPress 등 터치 props가 있을 때만 TouchableOpacity로 감쌈
// onPress 없이 사용하면 비주얼만 렌더링 → ContextMenu 등 외부 터치 핸들러와 충돌 없음
export function GlassButtonItem({
    children,
    className,
    ...touchableProps
}: Props & TouchableOpacityProps) {
    const glassClass = cn('rounded-full items-center justify-center', className);
    const hasTouchHandler = !!(
        touchableProps.onPress ||
        touchableProps.onLongPress ||
        touchableProps.onPressIn ||
        touchableProps.onPressOut
    );

    const visual = <GlassVisual className={glassClass}>{children}</GlassVisual>;

    if (!hasTouchHandler) return visual;

    return (
        <TouchableOpacity activeOpacity={1} {...touchableProps}>
            {visual}
        </TouchableOpacity>
    );
}

// 시간표 메뉴 전용 interactive pill (텍스트 + 아이콘)
// 사용법: <TouchableOpacity activeOpacity={1}><GlassView className="...">...</GlassView></TouchableOpacity>
export function GlassView({ children, className }: Props) {
    return <GlassVisual className={className}>{children}</GlassVisual>;
}
