import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({ navigation }: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold mb-8">설정</Text>
      <TouchableOpacity
        className="bg-gray-200 px-6 py-3 rounded-lg"
        onPress={() => navigation.goBack()}
      >
        <Text className="text-gray-800 font-semibold">뒤로</Text>
      </TouchableOpacity>
    </View>
  );
}
