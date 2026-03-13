import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import {
  List,
  Switch,
  Divider,
  Button,
  TextInput,
  Portal,
  Modal,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getTimetables, saveTimetables } from '../store/timetableStore';
import type { Timetable } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
  route: RouteProp<RootStackParamList, 'Settings'>;
};

function timeStringToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function SettingsScreen({ navigation, route }: Props) {
  const { timetableId } = route.params;

  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [tempName, setTempName] = useState('');

  // 시간 피커
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTimeField, setEditingTimeField] = useState<'start' | 'end'>('start');
  const [pendingTime, setPendingTime] = useState('07:00');
  const [originalTime, setOriginalTime] = useState('07:00');

  useFocusEffect(
    useCallback(() => {
      setTimetables(getTimetables());
    }, []),
  );

  const current = timetables.find(tt => tt.id === timetableId);
  const ttStart = current?.timeRangeStart ?? '07:00';
  const ttEnd = current?.timeRangeEnd ?? '23:00';
  const ttShowWeekends = current?.showWeekends ?? false;

  function updateCurrent(patch: Partial<Timetable>) {
    const updated = timetables.map(tt =>
      tt.id === timetableId ? { ...tt, ...patch } : tt,
    );
    saveTimetables(updated);
    setTimetables(updated);
  }

  function openTimePicker(field: 'start' | 'end') {
    const current_time = field === 'start' ? ttStart : ttEnd;
    setEditingTimeField(field);
    setPendingTime(current_time);
    setOriginalTime(current_time);
    setTimePickerVisible(true);
  }

  function handleTimeChange(_: unknown, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setTimePickerVisible(false);
      if (!selectedDate) return;
      applyTime(dateToTimeString(selectedDate));
      return;
    }
    if (!selectedDate) return;
    setPendingTime(dateToTimeString(selectedDate));
  }

  function applyTime(time: string) {
    const newStart = editingTimeField === 'start' ? time : ttStart;
    const newEnd = editingTimeField === 'end' ? time : ttEnd;
    if (newStart >= newEnd) {
      Alert.alert('시간 오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    updateCurrent({ timeRangeStart: newStart, timeRangeEnd: newEnd });
  }

  function confirmTimePicker() {
    applyTime(pendingTime);
    setTimePickerVisible(false);
  }

  function cancelTimePicker() {
    setTimePickerVisible(false);
  }

  function openRenameModal() {
    setTempName(current?.name ?? '');
    setRenameModalVisible(true);
  }

  function confirmRename() {
    const trimmed = tempName.trim();
    if (!trimmed) {
      Alert.alert('알림', '시간표 이름을 입력해 주세요.');
      return;
    }
    updateCurrent({ name: trimmed });
    setRenameModalVisible(false);
  }

  function handleDelete() {
    if (timetables.length <= 1) {
      Alert.alert('알림', '시간표가 1개 이상 있어야 합니다.');
      return;
    }
    Alert.alert(
      '시간표 삭제',
      `"${current?.name}"을(를) 삭제하시겠습니까?\n포함된 모든 일정도 함께 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            const updated = timetables
              .filter(t => t.id !== timetableId)
              .map((t, i) => ({ ...t, order: i }));
            saveTimetables(updated);
            navigation.goBack();
          },
        },
      ],
    );
  }

  if (!current) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* 시간표 정보 섹션 */}
      <List.Section>
        <List.Subheader style={styles.subheader}>시간표</List.Subheader>
        <View style={styles.card}>
          <List.Item
            title={current.name}
            description="시간표 이름"
            right={() => (
              <TouchableOpacity onPress={openRenameModal} style={styles.editBtn}>
                <Text style={{ color: '#3b82f6', fontSize: 14 }}>편집</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </List.Section>

      {/* 시간 범위 섹션 */}
      <List.Section>
        <List.Subheader style={styles.subheader}>시간 범위</List.Subheader>
        <View style={styles.card}>
          <List.Item
            title="시작 시간"
            description="시간표가 시작되는 시각"
            right={() => (
              <View style={styles.timeValue}>
                <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 16 }}>
                  {ttStart}
                </Text>
              </View>
            )}
            onPress={() => openTimePicker('start')}
          />
          <Divider />
          <List.Item
            title="종료 시간"
            description="시간표가 끝나는 시각"
            right={() => (
              <View style={styles.timeValue}>
                <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 16 }}>
                  {ttEnd}
                </Text>
              </View>
            )}
            onPress={() => openTimePicker('end')}
          />
        </View>
      </List.Section>

      {/* 표시 설정 섹션 */}
      <List.Section>
        <List.Subheader style={styles.subheader}>표시 설정</List.Subheader>
        <View style={styles.card}>
          <List.Item
            title="주말 표시"
            description="토요일 · 일요일 컬럼 표시"
            right={() => (
              <Switch
                value={ttShowWeekends}
                onValueChange={v => updateCurrent({ showWeekends: v })}
              />
            )}
          />
        </View>
      </List.Section>

      {/* 시간표 삭제 */}
      {timetables.length > 1 && (
        <List.Section>
          <View style={styles.card}>
            <List.Item
              title="시간표 삭제"
              titleStyle={{ color: '#ef4444' }}
              onPress={handleDelete}
            />
          </View>
        </List.Section>
      )}

      {/* 버전 정보 */}
      <List.Section>
        <View style={styles.card}>
          <List.Item
            title="버전"
            right={() => (
              <Text style={{ color: '#9ca3af', alignSelf: 'center' }}>0.0.1</Text>
            )}
          />
        </View>
      </List.Section>

      {/* 시간표 이름 변경 모달 */}
      <Portal>
        <Modal
          visible={renameModalVisible}
          onDismiss={() => setRenameModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={{ marginBottom: 16, fontWeight: '600', fontSize: 16 }}>
            시간표 이름 변경
          </Text>
          <TextInput
            label="시간표 이름"
            mode="outlined"
            value={tempName}
            onChangeText={setTempName}
            autoFocus
            style={{ backgroundColor: '#fff' }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onPress={() => setRenameModalVisible(false)} textColor="#6b7280">
              취소
            </Button>
            <Button mode="contained" onPress={confirmRename}>
              확인
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* OS 기본 시간 피커 — Android */}
      {timePickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          mode="time"
          display="default"
          value={timeStringToDate(pendingTime)}
          onChange={handleTimeChange}
          minuteInterval={30}
        />
      )}

      {/* OS 기본 시간 피커 — iOS sheet */}
      {timePickerVisible && Platform.OS === 'ios' && (
        <View style={styles.iosPickerOverlay}>
          <View style={styles.iosPickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={cancelTimePicker}>
                <Text style={styles.pickerCancel}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {editingTimeField === 'start' ? '시작 시간' : '종료 시간'}
              </Text>
              <TouchableOpacity onPress={confirmTimePicker}>
                <Text style={styles.pickerConfirm}>확인</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="time"
              display="spinner"
              value={timeStringToDate(pendingTime)}
              onChange={handleTimeChange}
              minuteInterval={30}
              locale="ko_KR"
              style={{ width: '100%' }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subheader: {
    color: '#6b7280',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timeValue: {
    alignSelf: 'center',
    paddingRight: 4,
  },
  editBtn: {
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  modal: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
  },
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
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerCancel: {
    fontSize: 17,
    color: '#8E8E93',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  pickerConfirm: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
