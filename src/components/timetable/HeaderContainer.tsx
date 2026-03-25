// iOS BlurView / Android 일반 View 분기 헤더 컨테이너
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { cssInterop } from 'nativewind';
import { cn } from '@/utils/cn';

// BlurView는 기본적으로 className을 지원하지 않으므로 cssInterop으로 등록
cssInterop(BlurView, { className: 'style' });

const BASE_CLASS = 'absolute top-0 left-0 right-0 z-[10] border-b border-black/10';

// borderBottomWidth은 StyleSheet.hairlineWidth(0.5px 이하)로 hairline 두께를 보장해야 하므로 style에 유지
const hairlineStyle = { borderBottomWidth: StyleSheet.hairlineWidth };

// Platform.OS는 런타임에 변경되지 않으므로 prop 대신 내부에서 직접 판단
export function HeaderContainer({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    if (Platform.OS === 'ios') {
        return (
            <BlurView
                blurType="prominent"
                blurAmount={20}
                style={hairlineStyle}
                className={cn(BASE_CLASS, className)}
            >
                {children}
            </BlurView>
        );
    }
    return (
        <View
            style={hairlineStyle}
            className={cn(BASE_CLASS, 'bg-white/[0.95]', className)}
        >
            {children}
        </View>
    );
}
