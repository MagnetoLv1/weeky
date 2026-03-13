import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import {
  Text,
  List,
  Switch,
  Divider,
  Button,
  TextInput,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';
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

export default function SettingsScreen({ navigation, route }: Props) {
  const { timetableId } = route.params;

  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [editingTimeField, setEditingTimeField] = useState<'start' | 'end'>('start');
  const [tempTime, setTempTime] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [tempName, setTempName] = useState('');

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

  function openTimeModal(field: 'start' | 'end') {
    setEditingTimeField(field);
    setTempTime(field === 'start' ? ttStart : ttEnd);
    setTimeModalVisible(true);
  }

  function confirmTimeModal() {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(tempTime)) {
      Alert.alert('형식 오류', 'HH:MM 형식으로 입력해 주세요. (예: 07:00)');
      return;
    }
    const newStart = editingTimeField === 'start' ? tempTime : ttStart;
    const newEnd = editingTimeField === 'end' ? tempTime : ttEnd;
    if (newStart >= newEnd) {
      Alert.alert('시간 오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    updateCurrent({ timeRangeStart: newStart, timeRangeEnd: newEnd });
    setTimeModalVisible(false);
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
              <IconButton
                icon="pencil-outline"
                size={18}
                iconColor="#3b82f6"
                onPress={openRenameModal}
              />
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
                <Text variant="titleMedium" style={{ color: '#3b82f6', fontWeight: '600' }}>
                  {ttStart}
                </Text>
              </View>
            )}
            onPress={() => openTimeModal('start')}
          />
          <Divider />
          <List.Item
            title="종료 시간"
            description="시간표가 끝나는 시각"
            right={() => (
              <View style={styles.timeValue}>
                <Text variant="titleMedium" style={{ color: '#3b82f6', fontWeight: '600' }}>
                  {ttEnd}
                </Text>
              </View>
            )}
            onPress={() => openTimeModal('end')}
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
              <Text variant="bodyMedium" style={{ color: '#9ca3af', alignSelf: 'center' }}>
                0.0.1
              </Text>
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
          <Text variant="titleMedium" style={{ marginBottom: 16, fontWeight: '600' }}>
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

      {/* 시간 편집 모달 */}
      <Portal>
        <Modal
          visible={timeModalVisible}
          onDismiss={() => setTimeModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ marginBottom: 16, fontWeight: '600' }}>
            {editingTimeField === 'start' ? '시작 시간 설정' : '종료 시간 설정'}
          </Text>
          <TextInput
            label="시간 (HH:MM)"
            mode="outlined"
            value={tempTime}
            onChangeText={setTempTime}
            placeholder="07:00"
            keyboardType="numbers-and-punctuation"
            autoFocus
            style={{ backgroundColor: '#fff' }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onPress={() => setTimeModalVisible(false)} textColor="#6b7280">
              취소
            </Button>
            <Button mode="contained" onPress={confirmTimeModal}>
              확인
            </Button>
          </View>
        </Modal>
      </Portal>
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
  modal: {
    backgroundColor: '#fff',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
  },
});
