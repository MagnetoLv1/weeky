import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Switch } from 'react-native-paper';
import { Check, ChevronRight } from 'lucide-react-native';
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

const NOTIF_LABELS: Record<number, string> = {
  0: '시작 시간',
  5: '5분 전',
  10: '10분 전',
  15: '15분 전',
  30: '30분 전',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTimeDisplay(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  if (h === 0) return `오전 12:${mStr}`;
  if (h === 12) return `오후 12:${mStr}`;
  if (h < 12) return `오전 ${h}:${mStr}`;
  return `오후 ${h - 12}:${mStr}`;
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
  const [notifMinutes, setNotifMinutes] = useState<0 | 5 | 10 | 15 | 30>(
    schedule?.notification?.minutesBefore ?? 10,
  );
  const colorScrollRef = useRef<ScrollView>(null);

  const COLOR_CIRCLE = 36;
  const COLOR_GAP = 10;
  const COLOR_STRIDE = COLOR_CIRCLE + COLOR_GAP;

  // 화면 열릴 때 선택된 색상이 가운데 오도록 스크롤
  useEffect(() => {
    const idx = PASTEL_COLORS.indexOf(color);
    if (idx < 0) return;
    const screenW = Dimensions.get('window').width;
    const scrollX = Math.max(0, idx * COLOR_STRIDE - screenW / 2 + COLOR_CIRCLE / 2 + 16);
    setTimeout(() => {
      colorScrollRef.current?.scrollTo({ x: scrollX, animated: false });
    }, 50);
  }, []);

  const [showNotifPicker, setShowNotifPicker] = useState(false);

  // 시간 피커
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTime, setEditingTime] = useState<'start' | 'end'>('start');
  const [pendingTime, setPendingTime] = useState<string>('09:00');
  const [originalTime, setOriginalTime] = useState<string>('09:00');

  function timeStringToDate(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  function dateToTimeString(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function openTimePicker(type: 'start' | 'end') {
    const current = type === 'start' ? startTime : endTime;
    setEditingTime(type);
    setPendingTime(current);
    setOriginalTime(current);
    setTimePickerVisible(true);
  }

  function handleTimeChange(_: unknown, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setTimePickerVisible(false);
      if (!selectedDate) return;
      const timeStr = dateToTimeString(selectedDate);
      if (editingTime === 'start') setStartTime(timeStr);
      else setEndTime(timeStr);
      return;
    }
    if (!selectedDate) return;
    setPendingTime(dateToTimeString(selectedDate));
  }

  function confirmTimePicker() {
    if (editingTime === 'start') setStartTime(pendingTime);
    else setEndTime(pendingTime);
    setTimePickerVisible(false);
  }

  function cancelTimePicker() {
    // originalTime은 이미 state에 유지되므로 아무 것도 반영하지 않고 닫기
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

  const notifValueLabel = notifEnabled ? NOTIF_LABELS[notifMinutes] : '없음';
  const selectedDaysLabel = selectedDays.length === 7
    ? '매일'
    : selectedDays.map(i => DAYS[i]).join(', ') || '없음';

  return (
    <View style={styles.root}>
      {/* ── 헤더 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerCancel}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? '일정 편집' : '새로운 일정'}
        </Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
          <Text style={styles.headerAdd}>{isEditing ? '수정' : '추가'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Card 1: 제목 / 부제 ── */}
          <View style={styles.card}>
            <TextInput
              style={styles.titleInput}
              placeholder="제목"
              placeholderTextColor="#C7C7CC"
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />
            <View style={styles.rowDivider} />
            <TextInput
              style={styles.subtitleInput}
              placeholder="위치 또는 부제"
              placeholderTextColor="#C7C7CC"
              value={subTitle}
              onChangeText={setSubTitle}
              returnKeyType="next"
            />
          </View>

          {/* ── Card 2: 시간 ── */}
          <View style={styles.card}>
            {/* 반복 요일 */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>반복 요일</Text>
              <Text style={styles.rowValueGray}>{selectedDaysLabel}</Text>
            </View>
            <View style={styles.rowDivider} />
            {/* 요일 칩 */}
            <View style={styles.daysRow}>
              {DAYS.map((day, i) => (
                <TouchableOpacity
                  key={day}
                  onPress={() => toggleDay(i)}
                  style={[
                    styles.dayChip,
                    selectedDays.includes(i) && styles.dayChipSelected,
                  ]}
                >
                  <Text style={[
                    styles.dayChipText,
                    selectedDays.includes(i) && styles.dayChipTextSelected,
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.rowDivider} />
            {/* 시작 */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>시작</Text>
              <TouchableOpacity
                onPress={() => openTimePicker('start')}
                style={styles.timePill}
              >
                <Text style={styles.timePillText}>{formatTimeDisplay(startTime)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rowDivider} />
            {/* 종료 */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>종료</Text>
              <TouchableOpacity
                onPress={() => openTimePicker('end')}
                style={styles.timePill}
              >
                <Text style={styles.timePillText}>{formatTimeDisplay(endTime)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Card 3: 색상 ── */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>색상</Text>
              <View style={[styles.colorDot, { backgroundColor: color }]} />
            </View>
            <View style={styles.rowDivider} />
            <ScrollView
              ref={colorScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
            >
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
                  {color === c && <Check size={14} color="#1f2937" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Card 4: 알림 ── */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>알림</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Switch
                  value={notifEnabled}
                  onValueChange={setNotifEnabled}
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              </View>
            </View>
            {notifEnabled && (
              <>
                <View style={styles.rowDivider} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setShowNotifPicker(v => !v)}
                >
                  <Text style={styles.rowLabel}>시간</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={styles.rowValueGray}>{notifValueLabel}</Text>
                    <ChevronRight size={16} color="#8E8E93" />
                  </View>
                </TouchableOpacity>
                {showNotifPicker && (
                  <>
                    <View style={styles.rowDivider} />
                    <View style={styles.notifOptions}>
                      {([0, 5, 10, 15, 30] as const).map(min => (
                        <TouchableOpacity
                          key={min}
                          style={[
                            styles.notifChip,
                            notifMinutes === min && styles.notifChipSelected,
                          ]}
                          onPress={() => { setNotifMinutes(min); setShowNotifPicker(false); }}
                        >
                          <Text style={[
                            styles.notifChipText,
                            notifMinutes === min && styles.notifChipTextSelected,
                          ]}>
                            {NOTIF_LABELS[min]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* ── Card 5: 메모 ── */}
          <View style={styles.card}>
            <TextInput
              style={styles.memoInput}
              placeholder="메모"
              placeholderTextColor="#C7C7CC"
              value={memo}
              onChangeText={setMemo}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── 삭제 버튼 (편집 모드) ── */}
          {isEditing && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteCard}>
              <Text style={styles.deleteText}>일정 삭제</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── OS 기본 시간 피커 ── */}
      {timePickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          mode="time"
          display="default"
          value={timeStringToDate(editingTime === 'start' ? startTime : endTime)}
          onChange={handleTimeChange}
          minuteInterval={10}
        />
      )}
      {timePickerVisible && Platform.OS === 'ios' && (
        <View style={styles.iosPickerOverlay}>
          <View style={styles.iosPickerContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={cancelTimePicker}>
                <Text style={styles.modalCancel}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTime === 'start' ? '시작 시간' : '종료 시간'}
              </Text>
              <TouchableOpacity onPress={confirmTimePicker}>
                <Text style={styles.modalConfirm}>확인</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="time"
              display="spinner"
              value={timeStringToDate(pendingTime)}
              onChange={handleTimeChange}
              minuteInterval={10}
              locale="ko_KR"
              style={{ width: '100%' }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const IOS_BG = '#F2F2F7';
const IOS_LABEL = '#1C1C1E';
const IOS_GRAY = '#8E8E93';
const IOS_SEPARATOR = '#E5E5EA';
const IOS_BLUE = '#3B82F6';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOS_BG,
  },
  // ── 헤더 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: IOS_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_SEPARATOR,
  },
  headerBtn: {
    minWidth: 48,
  },
  headerCancel: {
    fontSize: 17,
    color: IOS_BLUE,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_LABEL,
  },
  headerAdd: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_BLUE,
    textAlign: 'right',
  },
  // ── 카드 ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  // ── 행 ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 50,
  },
  rowLabel: {
    fontSize: 17,
    color: IOS_LABEL,
  },
  rowValueGray: {
    fontSize: 17,
    color: IOS_GRAY,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_SEPARATOR,
    marginLeft: 16,
  },
  // ── 입력 ──
  titleInput: {
    fontSize: 17,
    color: IOS_LABEL,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  subtitleInput: {
    fontSize: 17,
    color: IOS_LABEL,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  memoInput: {
    fontSize: 17,
    color: IOS_LABEL,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
  },
  // ── 요일 칩 ──
  daysRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  dayChip: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    backgroundColor: IOS_SEPARATOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipSelected: {
    backgroundColor: IOS_BLUE,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_LABEL,
  },
  dayChipTextSelected: {
    color: '#FFFFFF',
  },
  // ── 시간 pill ──
  timePill: {
    backgroundColor: IOS_SEPARATOR,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timePillText: {
    fontSize: 17,
    color: IOS_BLUE,
    fontWeight: '500',
  },
  // ── 색상 ──
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: IOS_BLUE,
  },
  // ── 알림 옵션 ──
  notifOptions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  notifChip: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: IOS_SEPARATOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifChipSelected: {
    backgroundColor: IOS_BLUE,
  },
  notifChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_LABEL,
  },
  notifChipTextSelected: {
    color: '#FFFFFF',
  },
  // ── 삭제 ──
  deleteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 17,
    color: '#FF3B30',
  },
  // ── iOS 시간 피커 ──
  iosPickerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  iosPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalCancel: {
    fontSize: 17,
    color: IOS_GRAY,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_LABEL,
  },
  modalConfirm: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_BLUE,
  },
});
