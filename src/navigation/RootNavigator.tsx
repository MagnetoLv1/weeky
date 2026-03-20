import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainScreen from '@/screens/MainScreen';
import ScheduleFormScreen from '@/screens/ScheduleFormScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import type { Schedule } from '@/types';

export type RootStackParamList = {
  Main: { activeIndex?: number } | undefined;
  ScheduleForm: {
    schedule?: Schedule;
    timetableId?: string;
    defaultDay?: number;
    defaultStartTime?: string;
    defaultEndTime?: string;
  };
  Settings: { timetableId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={MainScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ScheduleForm"
        component={ScheduleFormScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정', headerBackTitle: '뒤로' }}
      />
    </Stack.Navigator>
  );
}
