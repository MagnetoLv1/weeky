import notifee, {
    AndroidImportance,
    AuthorizationStatus,
    RepeatFrequency,
    TriggerType,
    type TimestampTrigger,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import type { Schedule, Timetable } from '@/types';

const CHANNEL_ID = 'weeky-schedule';

/** Android 알림 채널 생성 */
export async function setupNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await notifee.createChannel({
        id: CHANNEL_ID,
        name: '일정 알림',
        importance: AndroidImportance.HIGH,
    });
}

/** iOS 알림 권한 요청 */
export async function requestNotificationPermission(): Promise<void> {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
        console.warn('알림 권한이 거부되었습니다.');
    }
}

/**
 * 앱 내부 dayOfWeek(0=월~6=일) → JS Date getDay()(0=일~6=토) 변환
 */
function appDayToJsDay(appDay: number): number {
    // 0=월→1, 1=화→2, ..., 5=토→6, 6=일→0
    return (appDay + 1) % 7;
}

/**
 * 다음 발생 시각 계산
 * @param jsDay JS Date 기준 요일 (0=일~6=토)
 * @param hours 시
 * @param minutes 분
 */
function getNextTriggerTimestamp(
    jsDay: number,
    hours: number,
    minutes: number,
): number {
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    const todayJsDay = now.getDay();
    let daysUntil = jsDay - todayJsDay;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && target.getTime() <= now.getTime()) {
        daysUntil = 7;
    }

    target.setDate(target.getDate() + daysUntil);
    return target.getTime();
}

/** 알림 메시지 생성 */
function buildNotifBody(title: string, minutesBefore: number): string {
    return minutesBefore > 0
        ? `${title} ${minutesBefore}분전입니다.`
        : `${title} 시작시간입니다.`;
}

/** 스케줄의 모든 요일별 알림 등록 */
export async function registerScheduleNotifications(
    schedule: Schedule,
): Promise<void> {
    if (!schedule.notification?.enabled) return;

    const { minutesBefore } = schedule.notification;
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const body = buildNotifBody(schedule.title, minutesBefore);

    for (const appDay of schedule.dayOfWeek) {
        let alertH = startH;
        let alertM = startM - minutesBefore;
        if (alertM < 0) {
            alertH -= 1;
            alertM += 60;
        }
        if (alertH < 0) {
            alertH += 24;
        }

        const jsDay = appDayToJsDay(appDay);
        const timestamp = getNextTriggerTimestamp(jsDay, alertH, alertM);

        const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp,
            repeatFrequency: RepeatFrequency.WEEKLY,
        };

        await notifee.createTriggerNotification(
            {
                id: `notif-${schedule.id}-${appDay}`,
                title: '일정 알림',
                body,
                android: { channelId: CHANNEL_ID },
            },
            trigger,
        );
    }
}

/** 해당 스케줄의 모든 요일 알림 취소 */
export async function cancelScheduleNotifications(
    scheduleId: string,
): Promise<void> {
    for (let day = 0; day <= 6; day++) {
        await notifee.cancelNotification(`notif-${scheduleId}-${day}`);
    }
}

/** 취소 후 재등록 */
export async function syncScheduleNotifications(
    schedule: Schedule,
): Promise<void> {
    await cancelScheduleNotifications(schedule.id);
    if (schedule.notification?.enabled) {
        await registerScheduleNotifications(schedule);
    }
}

/** 전체 알림 초기화 (앱 시작 시) */
export async function syncAllNotifications(
    timetables: Timetable[],
): Promise<void> {
    await notifee.cancelAllNotifications();
    for (const tt of timetables) {
        for (const schedule of tt.schedules) {
            if (schedule.notification?.enabled) {
                await registerScheduleNotifications(schedule);
            }
        }
    }
}
