import type { RootStackParamList } from '@/navigation/RootNavigator';
import { hasHolidaysForYear, saveHolidays } from '@/store/holidayStore';
import { getTimetables, saveTimetables } from '@/store/timetableStore';
import type { Timetable } from '@/types';
import { fetchHolidaysForYear } from '@/utils/holidayApi';
import { cancelScheduleNotifications } from '@/utils/notification';
import { generateTimetableHtml } from '@/utils/printHtml';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Divider, List, Switch } from 'react-native-paper';
import RNPrint from 'react-native-print';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
    route: RouteProp<RootStackParamList, 'Settings'>;
};

// 설정 화면에서 편집하는 필드들의 드래프트 타입
type DraftSettings = {
    name: string;
    timeRangeStart: string;
    timeRangeEnd: string;
    showWeekends: boolean;
    holidaySync: boolean;
};

function timeStringToDate(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

function dateToTimeString(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
    ).padStart(2, '0')}`;
}

export default function SettingsScreen({ navigation, route }: Props) {
    const { timetableId } = route.params;

    const [timetables, setTimetables] = useState<Timetable[]>([]);

    // 드래프트 패턴: 원본 저장값(original)과 편집 중인 값(draft)을 분리
    // 완료 버튼을 눌러야만 store에 반영, 뒤로가기 시 draft는 자동으로 폐기됨
    const [original, setOriginal] = useState<DraftSettings | null>(null);
    const [draft, setDraft] = useState<DraftSettings | null>(null);

    // 시간 피커
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [editingTimeField, setEditingTimeField] = useState<'start' | 'end'>(
        'start',
    );
    const [pendingTime, setPendingTime] = useState('07:00');

    // 변경 여부: original과 draft가 다를 때만 완료 버튼 활성화
    const isDirty =
        draft !== null &&
        original !== null &&
        JSON.stringify(draft) !== JSON.stringify(original);

    // 화면 진입 시 timetables 로드 + original/draft 초기화
    useFocusEffect(
        useCallback(() => {
            const tts = getTimetables();
            setTimetables(tts);
            const cur = tts.find(tt => tt.id === timetableId);
            if (cur) {
                const settings: DraftSettings = {
                    name: cur.name,
                    timeRangeStart: cur.timeRangeStart ?? '07:00',
                    timeRangeEnd: cur.timeRangeEnd ?? '23:00',
                    showWeekends: cur.showWeekends ?? false,
                    holidaySync: cur.holidaySync ?? false,
                };
                setOriginal(settings);
                setDraft(settings);
            }
        }, [timetableId]),
    );

    // isDirty 변화 시 헤더 완료 버튼 업데이트
    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!isDirty}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="flex-row items-center gap-2 px-3"
                >
                    <Check
                        size={18}
                        color={isDirty ? '#007AFF' : '#9ca3af'}
                        strokeWidth={3}
                    />
                    <Text
                        className="font-semibold text-lg"
                        style={{
                            color: isDirty ? '#007AFF' : '#9ca3af',
                        }}
                    >
                        완료
                    </Text>
                </TouchableOpacity>
            ),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirty]);

    const current = timetables.find(tt => tt.id === timetableId);

    // store에 실제로 저장하는 함수 (완료 버튼에서만 호출)
    function updateCurrent(patch: Partial<Timetable>) {
        const updated = timetables.map(tt =>
            tt.id === timetableId ? { ...tt, ...patch } : tt,
        );
        saveTimetables(updated);
        setTimetables(updated);
    }

    // 완료 버튼 핸들러: draft를 store에 저장하고 뒤로 이동
    function handleSave() {
        if (!draft) return;
        const trimmed = draft.name.trim();
        if (!trimmed) {
            Alert.alert('알림', '시간표 이름을 입력해 주세요.');
            return;
        }
        updateCurrent({
            name: trimmed,
            timeRangeStart: draft.timeRangeStart,
            timeRangeEnd: draft.timeRangeEnd,
            showWeekends: draft.showWeekends,
            holidaySync: draft.holidaySync,
        });
        setOriginal({ ...draft, name: trimmed }); // dirty 해제
        navigation.goBack();
    }

    function openTimePicker(field: 'start' | 'end') {
        const currentTime =
            field === 'start'
                ? draft?.timeRangeStart ?? '07:00'
                : draft?.timeRangeEnd ?? '23:00';
        setEditingTimeField(field);
        setPendingTime(currentTime);
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

    // 시간 유효성 검사 후 draft에만 반영 (store 저장 없음)
    function applyTime(time: string) {
        if (!draft) return;
        const newStart =
            editingTimeField === 'start' ? time : draft.timeRangeStart;
        const newEnd = editingTimeField === 'end' ? time : draft.timeRangeEnd;
        if (newStart >= newEnd) {
            Alert.alert(
                '시간 오류',
                '종료 시간은 시작 시간보다 늦어야 합니다.',
            );
            return;
        }
        setDraft(
            d => d && { ...d, timeRangeStart: newStart, timeRangeEnd: newEnd },
        );
    }

    function confirmTimePicker() {
        applyTime(pendingTime);
        setTimePickerVisible(false);
    }

    function cancelTimePicker() {
        setTimePickerVisible(false);
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
                        // 삭제될 시간표의 모든 스케줄 알림 취소
                        if (current) {
                            for (const s of current.schedules) {
                                cancelScheduleNotifications(s.id);
                            }
                        }
                        const currentIndex = timetables.findIndex(
                            t => t.id === timetableId,
                        );
                        const newActiveIndex = Math.max(0, currentIndex - 1);
                        const updated = timetables
                            .filter(t => t.id !== timetableId)
                            .map((t, i) => ({ ...t, order: i }));
                        saveTimetables(updated);
                        navigation.navigate('Main', {
                            activeIndex: newActiveIndex,
                        });
                    },
                },
            ],
        );
    }

    if (!current || !draft) return null;

    return (
        <View className="flex-1">
        <ScrollView className="flex-1 bg-gray-50" contentInsetAdjustmentBehavior="automatic">
            {/* 시간표 정보 섹션 */}
            <List.Section>
                <List.Subheader className="text-gray-500 text-xs uppercase tracking-[0.5px]">
                    시간표 이름
                </List.Subheader>
                <View className="bg-white mx-4 rounded-xl overflow-hidden">
                    <View className="px-4 py-3">
                        <View className="flex-row items-center h-10">
                            <TextInput
                                value={draft.name}
                                onChangeText={v =>
                                    setDraft(d => d && { ...d, name: v })
                                }
                                placeholder="시간표 이름을 입력하세요"
                                placeholderTextColor="#9ca3af"
                                returnKeyType="done"
                                style={{
                                    flex: 1,
                                    fontSize: 16,
                                    color: '#1C1C1E',
                                    padding: 0,
                                    height: 40,
                                }}
                            />
                            {/* 입력 내용 지우기 */}
                            {draft.name.length > 0 && (
                                <TouchableOpacity
                                    onPress={() =>
                                        setDraft(d => d && { ...d, name: '' })
                                    }
                                    className="ml-2"
                                    hitSlop={{
                                        top: 8,
                                        bottom: 8,
                                        left: 8,
                                        right: 8,
                                    }}
                                >
                                    <View className="w-5 h-5 rounded-full bg-gray-300 items-center justify-center">
                                        <Text className="text-white text-xs font-bold leading-none">
                                            ×
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </List.Section>

            {/* 시간 범위 섹션 */}
            <List.Section>
                <List.Subheader className="text-gray-500 text-xs uppercase tracking-[0.5px]">
                    시간 범위
                </List.Subheader>
                <View className="bg-white mx-4 rounded-xl overflow-hidden">
                    <List.Item
                        title="시작 시간"
                        description="시간표가 시작되는 시각"
                        right={() => (
                            <View className="self-center pr-1">
                                <Text className="text-blue-500 font-semibold text-base">
                                    {draft.timeRangeStart}
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
                                <Text className="text-blue-500 font-semibold text-base">
                                    {draft.timeRangeEnd}
                                </Text>
                            </View>
                        )}
                        onPress={() => openTimePicker('end')}
                    />
                </View>
            </List.Section>

            {/* 표시 설정 섹션 */}
            <List.Section>
                <List.Subheader className="text-gray-500 text-xs uppercase tracking-[0.5px]">
                    표시 설정
                </List.Subheader>
                <View className="bg-white mx-4 rounded-xl overflow-hidden">
                    <List.Item
                        title="주말 표시"
                        description="토요일 · 일요일 컬럼 표시"
                        right={() => (
                            <Switch
                                value={draft.showWeekends}
                                onValueChange={v =>
                                    setDraft(
                                        d => d && { ...d, showWeekends: v },
                                    )
                                }
                            />
                        )}
                    />
                    <Divider />
                    <List.Item
                        title="공휴일 연동"
                        description="요일 헤더에 공휴일 표기"
                        right={() => (
                            <Switch
                                value={draft.holidaySync}
                                onValueChange={async v => {
                                    setDraft(
                                        d => d && { ...d, holidaySync: v },
                                    );
                                    // 토글 ON 시 해당 연도 데이터 없으면 즉시 프리페치 (캐싱 유지)
                                    if (v) {
                                        const year = new Date().getFullYear();
                                        if (!hasHolidaysForYear(year)) {
                                            try {
                                                const holidays =
                                                    await fetchHolidaysForYear(
                                                        year,
                                                    );
                                                saveHolidays(year, holidays);
                                            } catch {
                                                // 실패 무시
                                            }
                                        }
                                    }
                                }}
                            />
                        )}
                    />
                </View>
            </List.Section>

            {/* 내보내기 */}
            <List.Section>
                <List.Subheader className="text-gray-500 text-xs uppercase tracking-[0.5px]">
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
                            <Text className="text-gray-400 self-center">
                                0.0.1
                            </Text>
                        )}
                    />
                </View>
            </List.Section>

        </ScrollView>

        {/* OS 기본 시간 피커 — iOS sheet (ScrollView 바깥에 absolute 오버레이) */}
        {timePickerVisible && Platform.OS === 'ios' && (
            <View
                className="absolute inset-0 justify-end"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                pointerEvents="box-none"
            >
                <View className="bg-white rounded-tl-2xl rounded-tr-2xl pb-5">
                    <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                        <TouchableOpacity onPress={cancelTimePicker}>
                            <Text className="text-[17px] text-[#8E8E93]">
                                취소
                            </Text>
                        </TouchableOpacity>
                        <Text className="text-[17px] font-semibold text-[#1C1C1E]">
                            {editingTimeField === 'start'
                                ? '시작 시간'
                                : '종료 시간'}
                        </Text>
                        <TouchableOpacity onPress={confirmTimePicker}>
                            <Text className="text-[17px] font-semibold text-blue-500">
                                확인
                            </Text>
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
        </View>
    );
}
