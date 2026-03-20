// iOS BlurView / Android 일반 View 분기 헤더 컨테이너
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';

// 헤더 공통 스타일 (absolute 위치, 상단 고정, z-index 10)
const style = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
};

// Platform.OS는 런타임에 변경되지 않으므로 prop 대신 내부에서 직접 판단
export function HeaderContainer({ children }: { children: React.ReactNode }) {
    if (Platform.OS === 'ios') {
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
