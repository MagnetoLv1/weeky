import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
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
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { getTimetables, saveTimetables } from '@/store/timetableStore';
import type { Schedule } from '@/types';
import {
    syncScheduleNotifications,
    cancelScheduleNotifications,
} from '@/utils/notification';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'ScheduleForm'>;
    route: RouteProp<RootStackParamList, 'ScheduleForm'>;
};

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const PASTEL_COLORS = [
    '#FFB3C1',
    '#FFD6A5',
    '#FDFFB6',
    '#CAFFBF',
    '#9BF6FF',
    '#BDB2FF',
    '#FFC6FF',
    '#A0C4FF',
    '#FFD6BA',
    '#B5EAD7',
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
    const {
        schedule,
        timetableId,
        defaultDay,
        defaultStartTime,
        defaultEndTime,
    } = route.params ?? {};
    const isEditing = !!schedule;

    const [title, setTitle] = useState(schedule?.title ?? '');
    const [subTitle, setSubTitle] = useState(schedule?.subTitle ?? '');
    const [memo, setMemo] = useState(schedule?.memo ?? '');
    const [selectedDays, setSelectedDays] = useState<number[]>(
        schedule?.dayOfWeek ?? (defaultDay !== undefined ? [defaultDay] : []),
    );
    const [startTime, setStartTime] = useState(
        schedule?.startTime ?? defaultStartTime ?? '09:00',
    );
    const [endTime, setEndTime] = useState(
        schedule?.endTime ?? defaultEndTime ?? '10:00',
    );
    const [color, setColor] = useState(schedule?.color ?? PASTEL_COLORS[4]);
    const [notifEnabled, setNotifEnabled] = useState(
        schedule?.notification?.enabled ?? false,
    );
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
        const scrollX = Math.max(
            0,
            idx * COLOR_STRIDE - screenW / 2 + COLOR_CIRCLE / 2 + 16,
        );
        setTimeout(() => {
            colorScrollRef.current?.scrollTo({ x: scrollX, animated: false });
        }, 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [showNotifPicker, setShowNotifPicker] = useState(false);

    // 시간 피커
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [editingTime, setEditingTime] = useState<'start' | 'end'>('start');
    const [pendingTime, setPendingTime] = useState<string>('09:00');

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
        setTimePickerVisible(false);
    }

    function toggleDay(index: number) {
        setSelectedDays(prev =>
            prev.includes(index)
                ? prev.filter(d => d !== index)
                : [...prev, index],
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
                ? tt.schedules.map(s =>
                      s.id === newSchedule.id ? newSchedule : s,
                  )
                : [...tt.schedules, newSchedule];
            return { ...tt, schedules };
        });
        saveTimetables(updated);
        syncScheduleNotifications(newSchedule);
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
                        return {
                            ...tt,
                            schedules: tt.schedules.filter(
                                s => s.id !== schedule!.id,
                            ),
                        };
                    });
                    saveTimetables(updated);
                    cancelScheduleNotifications(schedule!.id);
                    navigation.goBack();
                },
            },
        ]);
    }

    const notifValueLabel = notifEnabled ? NOTIF_LABELS[notifMinutes] : '없음';
    const selectedDaysLabel =
        selectedDays.length === 7
            ? '매일'
            : selectedDays.map(i => DAYS[i]).join(', ') || '없음';

    return (
        <View className="flex-1 bg-[#F2F2F7]">
            {/* ── 헤더 ── */}
            <View
                className="flex-row items-center justify-between px-4 pt-4 pb-3 bg-[#F2F2F7]"
                style={{
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: '#E5E5EA',
                }}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="min-w-[48px]"
                >
                    <Text className="text-[17px] text-blue-500">취소</Text>
                </TouchableOpacity>
                <Text className="text-[17px] font-semibold text-[#1C1C1E]">
                    {isEditing ? '일정 편집' : '새로운 일정'}
                </Text>
                <TouchableOpacity onPress={handleSave} className="min-w-[48px]">
                    <Text className="text-[17px] font-semibold text-blue-500 text-right">
                        {isEditing ? '수정' : '추가'}
                    </Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        paddingTop: 20,
                        paddingBottom: 48,
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ── Card 1: 제목 / 부제 ── */}
                    <View className="bg-white rounded-xl mx-4 mb-5 overflow-hidden">
                        <TextInput
                            className="text-[17px] text-[#1C1C1E] px-4 py-[14px] min-h-[50px]"
                            placeholder="제목"
                            placeholderTextColor="#C7C7CC"
                            value={title}
                            onChangeText={setTitle}
                            returnKeyType="next"
                        />
                        <View
                            style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: '#E5E5EA',
                                marginLeft: 16,
                            }}
                        />
                        <TextInput
                            className="text-[17px] text-[#1C1C1E] px-4 py-[14px] min-h-[50px]"
                            placeholder="위치 또는 부제"
                            placeholderTextColor="#C7C7CC"
                            value={subTitle}
                            onChangeText={setSubTitle}
                            returnKeyType="next"
                        />
                    </View>

                    {/* ── Card 2: 시간 ── */}
                    <View className="bg-white rounded-xl mx-4 mb-5 overflow-hidden">
                        {/* 반복 요일 */}
                        <View className="flex-row items-center justify-between px-4 py-[13px] min-h-[50px]">
                            <Text className="text-[17px] text-[#1C1C1E]">
                                반복 요일
                            </Text>
                            <Text className="text-[17px] text-[#8E8E93]">
                                {selectedDaysLabel}
                            </Text>
                        </View>
                        <View
                            style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: '#E5E5EA',
                                marginLeft: 16,
                            }}
                        />
                        {/* 요일 칩 */}
                        <View className="flex-row px-3 py-[10px] gap-[6px]">
                            {DAYS.map((day, i) => (
                                <TouchableOpacity
                                    key={day}
                                    onPress={() => toggleDay(i)}
                                    className={cn(
                                        'flex-1 h-[34px] rounded-[17px] items-center justify-center',
                                        selectedDays.includes(i)
                                            ? 'bg-blue-500'
                                            : 'bg-[#E5E5EA]',
                                    )}
                                >
                                    <Text
                                        className={cn(
                                            'text-[13px] font-medium',
                                            selectedDays.includes(i)
                                                ? 'text-white'
                                                : 'text-[#1C1C1E]',
                                        )}
                                    >
                                        {day}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View
                            style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: '#E5E5EA',
                                marginLeft: 16,
                            }}
                        />
                        {/* 시작 */}
                        <View className="flex-row items-center justify-between px-4 py-[13px] min-h-[50px]">
                            <Text className="text-[17px] text-[#1C1C1E]">
                                시작
                            </Text>
                            <TouchableOpacity
                                onPress={() => openTimePicker('start')}
                                className="bg-[#E5E5EA] rounded-lg px-3 py-[6px]"
                            >
                                <Text className="text-[17px] text-blue-500 font-medium">
                                    {formatTimeDisplay(startTime)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View
                            style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: '#E5E5EA',
                                marginLeft: 16,
                            }}
                        />
                        {/* 종료 */}
                        <View className="flex-row items-center justify-between px-4 py-[13px] min-h-[50px]">
                            <Text className="text-[17px] text-[#1C1C1E]">
                                종료
                            </Text>
                            <TouchableOpacity
                                onPress={() => openTimePicker('end')}
                                className="bg-[#E5E5EA] rounded-lg px-3 py-[6px]"
                            >
                                <Text className="text-[17px] text-blue-500 font-medium">
                                    {formatTimeDisplay(endTime)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── Card 3: 색상 ── */}
                    <View className="bg-white rounded-xl mx-4 mb-5 overflow-hidden">
                        <View className="flex-row items-center justify-between px-4 py-[13px] min-h-[50px]">
                            <Text className="text-[17px] text-[#1C1C1E]">
                                색상
                            </Text>
                            <View
                                style={{
                                    backgroundColor: color,
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    borderWidth: 0.5,
                                    borderColor: 'rgba(0,0,0,0.08)',
                                }}
                            />
                        </View>
                        <View
                            style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: '#E5E5EA',
                                marginLeft: 16,
                            }}
                        />
                        <ScrollView
                            ref={colorScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                gap: 10,
                            }}
                        >
                            {PASTEL_COLORS.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    onPress={() => setColor(c)}
                                    style={[
                                        {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: c,
                                            borderWidth: color === c ? 3 : 0.5,
                                            borderColor:
                                                color === c
                                                    ? '#3B82F6'
                                                    : 'rgba(0,0,0,0.08)',
                                        },
                                    ]}
                                >
                                    {color === c && (
                                        <Check size={14} color="#1f2937" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* ── Card 4: 알림 ── */}
                    <View className="bg-white rounded-xl mx-4 mb-5 overflow-hidden">
                        <View className="flex-row items-center justify-between px-4 py-[13px] min-h-[50px]">
                            <Text className="text-[17px] text-[#1C1C1E]">
                                알림
                            </Text>
                            <View className="flex-row items-center gap-[10px]">
                                <Switch
                                    value={notifEnabled}
                                    onValueChange={setNotifEnabled}
                                    style={{
                                        transform: [
                                            { scaleX: 0.85 },
                                            { scaleY: 0.85 },
                                        ],
                                    }}
                                />
                            </View>
                        </View>
                        {notifEnabled && (
                            <>
                                <View
                                    style={{
                                        height: StyleSheet.hairlineWidth,
                                        backgroundColor: '#E5E5EA',
                                        marginLeft: 16,
                                    }}
                                />
                                <TouchableOpacity
                                    className="flex-row items-center justify-between px-4 py-[13px] min-h-[50px]"
                                    onPress={() => setShowNotifPicker(v => !v)}
                                >
                                    <Text className="text-[17px] text-[#1C1C1E]">
                                        시간
                                    </Text>
                                    <View className="flex-row items-center gap-[2px]">
                                        <Text className="text-[17px] text-[#8E8E93]">
                                            {notifValueLabel}
                                        </Text>
                                        <ChevronRight
                                            size={16}
                                            color="#8E8E93"
                                        />
                                    </View>
                                </TouchableOpacity>
                                {showNotifPicker && (
                                    <>
                                        <View
                                            style={{
                                                height: StyleSheet.hairlineWidth,
                                                backgroundColor: '#E5E5EA',
                                                marginLeft: 16,
                                            }}
                                        />
                                        <View className="flex-row px-3 py-[10px] gap-[6px]">
                                            {([0, 5, 10, 15, 30] as const).map(
                                                min => (
                                                    <TouchableOpacity
                                                        key={min}
                                                        className={cn(
                                                            'flex-1 h-[34px] rounded-lg items-center justify-center',
                                                            notifMinutes === min
                                                                ? 'bg-blue-500'
                                                                : 'bg-[#E5E5EA]',
                                                        )}
                                                        onPress={() => {
                                                            setNotifMinutes(
                                                                min,
                                                            );
                                                            setShowNotifPicker(
                                                                false,
                                                            );
                                                        }}
                                                    >
                                                        <Text
                                                            className={cn(
                                                                'text-[12px] font-medium',
                                                                notifMinutes ===
                                                                    min
                                                                    ? 'text-white'
                                                                    : 'text-[#1C1C1E]',
                                                            )}
                                                        >
                                                            {NOTIF_LABELS[min]}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ),
                                            )}
                                        </View>
                                    </>
                                )}
                            </>
                        )}
                    </View>

                    {/* ── Card 5: 메모 ── */}
                    <View className="bg-white rounded-xl mx-4 mb-5 overflow-hidden">
                        <TextInput
                            className="text-[17px] text-[#1C1C1E] px-4 py-[14px] min-h-[80px]"
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
                        <TouchableOpacity
                            onPress={handleDelete}
                            className="bg-white rounded-xl mx-4 mb-5 py-[14px] items-center"
                        >
                            <Text className="text-[17px] text-red-500">
                                일정 삭제
                            </Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── OS 기본 시간 피커 ── */}
            {timePickerVisible && Platform.OS === 'android' && (
                <DateTimePicker
                    mode="time"
                    display="default"
                    value={timeStringToDate(
                        editingTime === 'start' ? startTime : endTime,
                    )}
                    onChange={handleTimeChange}
                    minuteInterval={10}
                />
            )}
            {timePickerVisible && Platform.OS === 'ios' && (
                <View
                    className="absolute inset-0 justify-end"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                >
                    <View className="bg-white rounded-tl-2xl rounded-tr-2xl pb-5">
                        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                            <TouchableOpacity onPress={cancelTimePicker}>
                                <Text className="text-[17px] text-[#8E8E93]">
                                    취소
                                </Text>
                            </TouchableOpacity>
                            <Text className="text-[17px] font-semibold text-[#1C1C1E]">
                                {editingTime === 'start'
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
