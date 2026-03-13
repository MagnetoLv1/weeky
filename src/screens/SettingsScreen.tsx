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
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getSettings, saveSettings } from '../store/settingsStore';
import type { Settings } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export default function SettingsScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<Settings>({
    timeRangeStart: '07:00',
    timeRangeEnd: '23:00',
    showWeekends: false,
  });
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [editingTimeField, setEditingTimeField] = useState<'start' | 'end'>('start');
  const [tempTime, setTempTime] = useState('');

  useFocusEffect(
    useCallback(() => {
      setSettings(getSettings());
    }, []),
  );

  function openTimeModal(field: 'start' | 'end') {
    setEditingTimeField(field);
    setTempTime(field === 'start' ? settings.timeRangeStart : settings.timeRangeEnd);
    setTimeModalVisible(true);
  }

  function confirmTimeModal() {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(tempTime)) {
      Alert.alert('형식 오류', 'HH:MM 형식으로 입력해 주세요. (예: 07:00)');
      return;
    }
    const updated: Settings = {
      ...settings,
      ...(editingTimeField === 'start'
        ? { timeRangeStart: tempTime }
        : { timeRangeEnd: tempTime }),
    };
    if (updated.timeRangeStart >= updated.timeRangeEnd) {
      Alert.alert('시간 오류', '종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    setSettings(updated);
    saveSettings(updated);
    setTimeModalVisible(false);
  }

  function toggleWeekends(value: boolean) {
    const updated: Settings = { ...settings, showWeekends: value };
    setSettings(updated);
    saveSettings(updated);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
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
                  {settings.timeRangeStart}
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
                  {settings.timeRangeEnd}
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
                value={settings.showWeekends}
                onValueChange={toggleWeekends}
              />
            )}
          />
        </View>
      </List.Section>

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
