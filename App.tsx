import './src/global.css';
import React, { useEffect } from 'react';
import { Text, TextInput, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import RootNavigator from './src/navigation/RootNavigator';
import { getTimetables, initTimetablesIfNeeded } from './src/store/timetableStore';
import {
  setupNotificationChannel,
  requestNotificationPermission,
  syncAllNotifications,
} from './src/utils/notification';
import { initAppsFlyer } from './src/utils/appsflyer';

// iOS: 'Pretendard' 패밀리명 → fontWeight 자동 매핑 (Pretendard-Bold 등)
// Android: 'Pretendard-Regular' 고정 (weight 별도 파일 미매핑)
const DEFAULT_FONT = Platform.select({
  ios: 'Pretendard',
  android: 'Pretendard-Regular',
  default: 'Pretendard',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Text as any).defaultProps = { ...((Text as any).defaultProps ?? {}), style: { fontFamily: DEFAULT_FONT } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps ?? {}), style: { fontFamily: DEFAULT_FONT } };

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#3b82f6',
    secondary: '#6b7280',
  },
  fonts: Object.fromEntries(
    Object.entries(MD3LightTheme.fonts).map(([k, v]) => [
      k,
      { ...(v as object), fontFamily: DEFAULT_FONT },
    ]),
  ) as typeof MD3LightTheme.fonts,
};

export default function App() {
  useEffect(() => {
    initTimetablesIfNeeded();
    setupNotificationChannel();
    requestNotificationPermission();
    syncAllNotifications(getTimetables());
    initAppsFlyer(); // 앱 실행 시 AppsFlyer SDK 초기화
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        {/* BottomSheetModalProvider: BottomSheetModal이 네이티브 Modal 레이어에 렌더링되어 헤더 위에 표시 */}
        <BottomSheetModalProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </BottomSheetModalProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
