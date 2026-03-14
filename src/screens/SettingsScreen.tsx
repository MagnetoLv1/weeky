import React, { useCallback, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, Platform } from 'react-native';
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
import RNPrint from 'react-native-print';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getTimetables, saveTimetables } from '../store/timetableStore';
import { generateTimetableHtml } from '../utils/printHtml';
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

  async function handlePrint() {
    if (!current) return;
    const html = generateTimetableHtml(current);
    await RNPrint.print({ html });
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
            const currentIndex = timetables.findIndex(t => t.id === timetableId);
            const newActiveIndex = Math.max(0, currentIndex - 1);
            const updated = timetables
              .filter(t => t.id !== timetableId)
              .map((t, i) => ({ ...t, order: i }));
            saveTimetables(updated);
            navigation.navigate('Main', { activeIndex: newActiveIndex });
          },
        },
      ],
    );
  }

  if (!current) return null;

  return (
    <View className="flex-1 bg-gray-50">
      {/* 시간표 정보 섹션 */}
      <List.Section>
        <List.Subheader className="text-gray-500 text-[12px] uppercase tracking-[0.5px]">
          시간표
        </List.Subheader>
        <View className="bg-white mx-4 rounded-xl overflow-hidden">
          <List.Item
            title={current.name}
            description="시간표 이름"
            right={() => (
              <TouchableOpacity
                onPress={openRenameModal}
                className="self-center px-2"
              >
                <Text className="text-blue-500 text-[14px]">편집</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </List.Section>

      {/* 시간 범위 섹션 */}
      <List.Section>
        <List.Subheader className="text-gray-500 text-[12px] uppercase tracking-[0.5px]">
          시간 범위
        </List.Subheader>
        <View className="bg-white mx-4 rounded-xl overflow-hidden">
          <List.Item
            title="시작 시간"
            description="시간표가 시작되는 시각"
            right={() => (
              <View className="self-center pr-1">
                <Text className="text-blue-500 font-semibold text-[16px]">
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
              <View className="self-center pr-1">
                <Text className="text-blue-500 font-semibold text-[16px]">
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
        <List.Subheader className="text-gray-500 text-[12px] uppercase tracking-[0.5px]">
          표시 설정
        </List.Subheader>
        <View className="bg-white mx-4 rounded-xl overflow-hidden">
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

      {/* 내보내기 */}
      <List.Section>
        <List.Subheader className="text-gray-500 text-[12px] uppercase tracking-[0.5px]">
          내보내기
        </List.Subheader>
        <View className="bg-white mx-4 rounded-xl overflow-hidden">
          <List.Item
            title="시간표 프린트"
            description="A4 용지에 시간표를 인쇄합니다"
            onPress={handlePrint}
          />
        </View>
      </List.Section>

      {/* 시간표 삭제 */}
      {timetables.length > 1 && (
        <List.Section>
          <View className="bg-white mx-4 rounded-xl overflow-hidden">
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
        <View className="bg-white mx-4 rounded-xl overflow-hidden">
          <List.Item
            title="버전"
            right={() => (
              <Text className="text-gray-400 self-center">0.0.1</Text>
            )}
          />
        </View>
      </List.Section>

      {/* 시간표 이름 변경 모달 */}
      <Portal>
        <Modal
          visible={renameModalVisible}
          onDismiss={() => setRenameModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: '#fff',
            marginHorizontal: 24,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <Text className="mb-4 font-semibold text-[16px]">
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
          <View className="flex-row justify-end gap-2 mt-4">
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
        <View
          className="absolute inset-0 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <View className="bg-white rounded-tl-2xl rounded-tr-2xl pb-5">
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
              <TouchableOpacity onPress={cancelTimePicker}>
                <Text className="text-[17px] text-[#8E8E93]">취소</Text>
              </TouchableOpacity>
              <Text className="text-[17px] font-semibold text-[#1C1C1E]">
                {editingTimeField === 'start' ? '시작 시간' : '종료 시간'}
              </Text>
              <TouchableOpacity onPress={confirmTimePicker}>
                <Text className="text-[17px] font-semibold text-blue-500">확인</Text>
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
