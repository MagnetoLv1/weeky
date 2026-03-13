import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getTimetables, saveTimetables } from '../store/timetableStore';
import type { Schedule } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScheduleForm'>;
  route: RouteProp<RootStackParamList, 'ScheduleForm'>;
};

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const PASTEL_COLORS = [
  '#FFB3C1', '#FFD6A5', '#FDFFB6', '#CAFFBF',
  '#9BF6FF', '#BDB2FF', '#FFC6FF', '#A0C4FF',
  '#FFD6BA', '#B5EAD7',
];

const NOTIFICATION_OPTIONS: Array<5 | 10 | 15 | 30> = [5, 10, 15, 30];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '10', '20', '30', '40', '50'];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function ScheduleFormScreen({ navigation, route }: Props) {
  const { schedule, timetableId, defaultDay, defaultStartTime, defaultEndTime } = route.params ?? {};
  const isEditing = !!schedule;

  const [title, setTitle] = useState(schedule?.title ?? '');
  const [subTitle, setSubTitle] = useState(schedule?.subTitle ?? '');
  const [memo, setMemo] = useState(schedule?.memo ?? '');
  const [selectedDays, setSelectedDays] = useState<number[]>(
    schedule?.dayOfWeek ?? (defaultDay !== undefined ? [defaultDay] : []),
  );
  const [startTime, setStartTime] = useState(schedule?.startTime ?? defaultStartTime ?? '09:00');
  const [endTime, setEndTime] = useState(schedule?.endTime ?? defaultEndTime ?? '10:00');
  const [color, setColor] = useState(schedule?.color ?? PASTEL_COLORS[4]);
  const [notifEnabled, setNotifEnabled] = useState(schedule?.notification?.enabled ?? false);
  const [notifMinutes, setNotifMinutes] = useState<5 | 10 | 15 | 30>(
    schedule?.notification?.minutesBefore ?? 10,
  );

  // 시간 피커 모달
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTime, setEditingTime] = useState<'start' | 'end'>('start');
  const [pickerHour, setPickerHour] = useState('09');
  const [pickerMinute, setPickerMinute] = useState('00');

  function openTimePicker(type: 'start' | 'end') {
    const time = type === 'start' ? startTime : endTime;
    const [h, m] = time.split(':');
    setPickerHour(h);
    setPickerMinute(m);
    setEditingTime(type);
    setTimePickerVisible(true);
  }

  function confirmTimePicker() {
    const result = `${pickerHour}:${pickerMinute}`;
    if (editingTime === 'start') {
      setStartTime(result);
    } else {
      setEndTime(result);
    }
    setTimePickerVisible(false);
  }

  function toggleDay(index: number) {
    setSelectedDays(prev =>
      prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index],
    );
  }

  function handleSave() {
    if (!title.trim()) {
      Alert.alert('알림', '제목을 입력해 주세요.');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('알림', '요일을 1개 이상 선택해 주세요.');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('알림', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    const newSchedule: Schedule = {
      id: schedule?.id ?? generateId(),
      title: title.trim(),
      subTitle: subTitle.trim() || undefined,
      memo: memo.trim() || undefined,
      dayOfWeek: [...selectedDays].sort(),
      startTime,
      endTime,
      color,
      isRepeating: true,
      notification: notifEnabled
        ? { enabled: true, minutesBefore: notifMinutes }
        : undefined,
    };

    const timetables = getTimetables();
    const targetId = timetableId ?? timetables[0]?.id;
    const updated = timetables.map(tt => {
      if (tt.id !== targetId) return tt;
      const schedules = isEditing
        ? tt.schedules.map(s => (s.id === newSchedule.id ? newSchedule : s))
        : [...tt.schedules, newSchedule];
      return { ...tt, schedules };
    });
    saveTimetables(updated);
    navigation.goBack();
  }

  function handleDelete() {
    Alert.alert('일정 삭제', '이 일정을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          const timetables = getTimetables();
          const targetId = timetableId ?? timetables[0]?.id;
          const updated = timetables.map(tt => {
            if (tt.id !== targetId) return tt;
            return { ...tt, schedules: tt.schedules.filter(s => s.id !== schedule!.id) };
          });
          saveTimetables(updated);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-white">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-12">
          <Text className="text-base text-gray-500">취소</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-900">
          {isEditing ? '일정 편집' : '일정 추가'}
        </Text>
        <TouchableOpacity onPress={handleSave} className="w-12 items-end">
          <Text className="text-base font-semibold text-blue-500">저장</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 제목 */}
          <View className="mx-4 mt-5 mb-1">
            <Text className="text-xs font-medium text-gray-400 mb-1 ml-1">제목 *</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
              placeholder="예) 수학, 영어"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
          </View>

          {/* 부제/장소 */}
          <View className="mx-4 mb-1">
            <Text className="text-xs font-medium text-gray-400 mb-1 ml-1">장소/부제</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
              placeholder="예) 302호"
              placeholderTextColor="#9ca3af"
              value={subTitle}
              onChangeText={setSubTitle}
              returnKeyType="next"
            />
          </View>

          {/* 요일 선택 */}
          <View className="mx-4 mt-4 mb-1">
            <Text className="text-xs font-medium text-gray-400 mb-2 ml-1">반복 요일</Text>
            <View className="flex-row gap-2">
              {DAYS.map((day, i) => (
                <TouchableOpacity
                  key={day}
                  onPress={() => toggleDay(i)}
                  className={`flex-1 h-9 rounded-xl items-center justify-center border ${
                    selectedDays.includes(i)
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedDays.includes(i) ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 시간 */}
          <View className="mx-4 mt-4 mb-1">
            <Text className="text-xs font-medium text-gray-400 mb-2 ml-1">시간</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => openTimePicker('start')}
                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 items-center"
              >
                <Text className="text-xs text-gray-400 mb-0.5">시작</Text>
                <Text className="text-lg font-semibold text-gray-900">{startTime}</Text>
              </TouchableOpacity>
              <Text className="text-gray-300 text-xl">→</Text>
              <TouchableOpacity
                onPress={() => openTimePicker('end')}
                className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 items-center"
              >
                <Text className="text-xs text-gray-400 mb-0.5">종료</Text>
                <Text className="text-lg font-semibold text-gray-900">{endTime}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 색상 선택 */}
          <View className="mx-4 mt-4 mb-1">
            <Text className="text-xs font-medium text-gray-400 mb-2 ml-1">색상</Text>
            <View className="flex-row flex-wrap gap-3">
              {PASTEL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: color === c ? 3 : 0,
                    borderColor: '#3b82f6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {color === c && (
                    <Text style={{ fontSize: 14, color: '#1f2937' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 메모 */}
          <View className="mx-4 mt-4 mb-1">
            <Text className="text-xs font-medium text-gray-400 mb-1 ml-1">메모</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
              placeholder="메모를 입력하세요"
              placeholderTextColor="#9ca3af"
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 72 }}
            />
          </View>

          {/* 알림 설정 */}
          <View className="mx-4 mt-4 mb-1">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-medium text-gray-400 ml-1">알림</Text>
              <TouchableOpacity
                onPress={() => setNotifEnabled(v => !v)}
                className={`w-12 h-6 rounded-full px-0.5 justify-center ${
                  notifEnabled ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white shadow ${
                    notifEnabled ? 'self-end' : 'self-start'
                  }`}
                />
              </TouchableOpacity>
            </View>
            {notifEnabled && (
              <View className="flex-row gap-2">
                {NOTIFICATION_OPTIONS.map(min => (
                  <TouchableOpacity
                    key={min}
                    onPress={() => setNotifMinutes(min)}
                    className={`flex-1 py-2 rounded-xl border items-center ${
                      notifMinutes === min
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        notifMinutes === min ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {min}분 전
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 삭제 버튼 (편집 모드) */}
          {isEditing && (
            <TouchableOpacity
              onPress={handleDelete}
              className="mx-4 mt-8 py-3 rounded-xl border border-red-200 items-center"
            >
              <Text className="text-red-500 font-semibold">일정 삭제</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 시간 피커 모달 */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View className="flex-1 justify-end">
          {/* 딤 배경 */}
          <TouchableOpacity
            className="flex-1"
            onPress={() => setTimePickerVisible(false)}
          />
          <View className="bg-white rounded-t-3xl px-4 pb-8 pt-4">
            {/* 모달 헤더 */}
            <View className="flex-row justify-between items-center mb-4">
              <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                <Text className="text-base text-gray-500">취소</Text>
              </TouchableOpacity>
              <Text className="text-base font-semibold text-gray-900">
                {editingTime === 'start' ? '시작 시간' : '종료 시간'}
              </Text>
              <TouchableOpacity onPress={confirmTimePicker}>
                <Text className="text-base font-semibold text-blue-500">확인</Text>
              </TouchableOpacity>
            </View>

            {/* 시:분 선택 */}
            <View className="flex-row justify-center items-center gap-2">
              {/* 시 */}
              <View className="flex-1" style={{ height: 200 }}>
                <FlatList
                  data={HOURS}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={44}
                  decelerationRate="fast"
                  initialScrollIndex={parseInt(pickerHour, 10)}
                  getItemLayout={(_, index) => ({
                    length: 44,
                    offset: 44 * index,
                    index,
                  })}
                  onMomentumScrollEnd={e => {
                    const index = Math.round(e.nativeEvent.contentOffset.y / 44);
                    setPickerHour(HOURS[Math.min(index, 23)]);
                  }}
                  renderItem={({ item }) => (
                    <View
                      className="h-11 items-center justify-center"
                    >
                      <Text
                        className={`text-2xl ${
                          item === pickerHour
                            ? 'font-bold text-gray-900'
                            : 'text-gray-300'
                        }`}
                      >
                        {item}
                      </Text>
                    </View>
                  )}
                  contentContainerStyle={{ paddingVertical: 78 }}
                />
              </View>

              <Text className="text-3xl font-bold text-gray-900">:</Text>

              {/* 분 */}
              <View className="flex-1" style={{ height: 200 }}>
                <FlatList
                  data={MINUTES}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={44}
                  decelerationRate="fast"
                  initialScrollIndex={MINUTES.indexOf(pickerMinute)}
                  getItemLayout={(_, index) => ({
                    length: 44,
                    offset: 44 * index,
                    index,
                  })}
                  onMomentumScrollEnd={e => {
                    const index = Math.round(e.nativeEvent.contentOffset.y / 44);
                    setPickerMinute(MINUTES[Math.min(index, MINUTES.length - 1)]);
                  }}
                  renderItem={({ item }) => (
                    <View className="h-11 items-center justify-center">
                      <Text
                        className={`text-2xl ${
                          item === pickerMinute
                            ? 'font-bold text-gray-900'
                            : 'text-gray-300'
                        }`}
                      >
                        {item}
                      </Text>
                    </View>
                  )}
                  contentContainerStyle={{ paddingVertical: 78 }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
