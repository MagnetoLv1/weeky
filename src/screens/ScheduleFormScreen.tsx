import React, { useState } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Chip,
  Switch,
  Portal,
  Modal,
  Divider,
  SegmentedButtons,
  Surface,
} from 'react-native-paper';
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

const NOTIFICATION_OPTIONS = [
  { value: '5', label: '5분 전' },
  { value: '10', label: '10분 전' },
  { value: '15', label: '15분 전' },
  { value: '30', label: '30분 전' },
];

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
    if (editingTime === 'start') setStartTime(result);
    else setEndTime(result);
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
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Button onPress={() => navigation.goBack()} textColor="#6b7280">
          취소
        </Button>
        <Text variant="titleMedium" style={{ fontWeight: '600' }}>
          {isEditing ? '일정 편집' : '일정 추가'}
        </Text>
        <Button mode="contained" onPress={handleSave} compact>
          저장
        </Button>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 제목 / 장소 */}
          <View style={styles.section}>
            <TextInput
              label="제목 *"
              mode="outlined"
              value={title}
              onChangeText={setTitle}
              placeholder="예) 수학, 영어"
              returnKeyType="next"
              style={styles.input}
            />
            <TextInput
              label="장소 / 부제"
              mode="outlined"
              value={subTitle}
              onChangeText={setSubTitle}
              placeholder="예) 302호"
              returnKeyType="next"
              style={[styles.input, { marginTop: 8 }]}
            />
          </View>

          <Divider />

          {/* 반복 요일 */}
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>반복 요일</Text>
            <View style={styles.chipRow}>
              {DAYS.map((day, i) => (
                <Chip
                  key={day}
                  selected={selectedDays.includes(i)}
                  onPress={() => toggleDay(i)}
                  mode="outlined"
                  style={styles.chip}
                  compact
                >
                  {day}
                </Chip>
              ))}
            </View>
          </View>

          <Divider />

          {/* 시간 */}
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>시간</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Surface style={styles.timeSurface} elevation={0}>
                <Button
                  mode="outlined"
                  onPress={() => openTimePicker('start')}
                  contentStyle={{ flexDirection: 'column', height: 56 }}
                  style={{ flex: 1 }}
                >
                  <Text variant="labelSmall" style={{ color: '#9ca3af' }}>시작{'\n'}</Text>
                  <Text variant="titleMedium">{startTime}</Text>
                </Button>
              </Surface>
              <Text variant="titleLarge" style={{ color: '#d1d5db' }}>→</Text>
              <Surface style={styles.timeSurface} elevation={0}>
                <Button
                  mode="outlined"
                  onPress={() => openTimePicker('end')}
                  contentStyle={{ flexDirection: 'column', height: 56 }}
                  style={{ flex: 1 }}
                >
                  <Text variant="labelSmall" style={{ color: '#9ca3af' }}>종료{'\n'}</Text>
                  <Text variant="titleMedium">{endTime}</Text>
                </Button>
              </Surface>
            </View>
          </View>

          <Divider />

          {/* 색상 */}
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>색상</Text>
            <View style={styles.chipRow}>
              {PASTEL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    color === c && styles.colorCircleSelected,
                  ]}
                >
                  {color === c && (
                    <Text style={{ fontSize: 14, color: '#1f2937' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Divider />

          {/* 메모 */}
          <View style={styles.section}>
            <TextInput
              label="메모"
              mode="outlined"
              value={memo}
              onChangeText={setMemo}
              placeholder="메모를 입력하세요"
              multiline
              numberOfLines={3}
              style={[styles.input, { minHeight: 80 }]}
            />
          </View>

          <Divider />

          {/* 알림 */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text variant="labelMedium" style={styles.sectionLabel}>알림</Text>
              <Switch value={notifEnabled} onValueChange={setNotifEnabled} />
            </View>
            {notifEnabled && (
              <SegmentedButtons
                value={String(notifMinutes)}
                onValueChange={v => setNotifMinutes(Number(v) as 5 | 10 | 15 | 30)}
                buttons={NOTIFICATION_OPTIONS}
              />
            )}
          </View>

          {/* 삭제 버튼 (편집 모드) */}
          {isEditing && (
            <View style={[styles.section, { paddingTop: 8 }]}>
              <Button
                mode="outlined"
                onPress={handleDelete}
                textColor="#ef4444"
                style={{ borderColor: '#fca5a5' }}
              >
                일정 삭제
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 시간 피커 모달 */}
      <Portal>
        <Modal
          visible={timePickerVisible}
          onDismiss={() => setTimePickerVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Button onPress={() => setTimePickerVisible(false)} textColor="#6b7280">취소</Button>
            <Text variant="titleMedium">
              {editingTime === 'start' ? '시작 시간' : '종료 시간'}
            </Text>
            <Button mode="contained" onPress={confirmTimePicker} compact>확인</Button>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            {/* 시 */}
            <View style={{ flex: 1, height: 200 }}>
              <FlatList
                data={HOURS}
                keyExtractor={item => item}
                showsVerticalScrollIndicator={false}
                snapToInterval={44}
                decelerationRate="fast"
                initialScrollIndex={parseInt(pickerHour, 10)}
                getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
                onMomentumScrollEnd={e => {
                  const index = Math.round(e.nativeEvent.contentOffset.y / 44);
                  setPickerHour(HOURS[Math.min(index, 23)]);
                }}
                renderItem={({ item }) => (
                  <View style={styles.pickerItem}>
                    <Text
                      variant="headlineSmall"
                      style={{ color: item === pickerHour ? '#111827' : '#d1d5db', fontWeight: item === pickerHour ? '700' : '400' }}
                    >
                      {item}
                    </Text>
                  </View>
                )}
                contentContainerStyle={{ paddingVertical: 78 }}
              />
            </View>

            <Text variant="headlineMedium" style={{ fontWeight: '700', color: '#111827' }}>:</Text>

            {/* 분 */}
            <View style={{ flex: 1, height: 200 }}>
              <FlatList
                data={MINUTES}
                keyExtractor={item => item}
                showsVerticalScrollIndicator={false}
                snapToInterval={44}
                decelerationRate="fast"
                initialScrollIndex={MINUTES.indexOf(pickerMinute)}
                getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
                onMomentumScrollEnd={e => {
                  const index = Math.round(e.nativeEvent.contentOffset.y / 44);
                  setPickerMinute(MINUTES[Math.min(index, MINUTES.length - 1)]);
                }}
                renderItem={({ item }) => (
                  <View style={styles.pickerItem}>
                    <Text
                      variant="headlineSmall"
                      style={{ color: item === pickerMinute ? '#111827' : '#d1d5db', fontWeight: item === pickerMinute ? '700' : '400' }}
                    >
                      {item}
                    </Text>
                  </View>
                )}
                contentContainerStyle={{ paddingVertical: 78 }}
              />
            </View>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionLabel: {
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 2,
  },
  timeSurface: {
    flex: 1,
    borderRadius: 12,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  modalContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
  },
  pickerItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
