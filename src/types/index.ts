export interface Schedule {
  id: string;
  title: string;
  subTitle?: string;
  memo?: string;
  dayOfWeek: number[];        // 0=월 ~ 6=일
  startTime: string;          // "09:00"
  endTime: string;            // "10:30"
  color: string;              // hex
  isRepeating: boolean;
  notification?: {
    enabled: boolean;
    minutesBefore: 5 | 10 | 15 | 30;
  };
}

export interface Timetable {
  id: string;
  name: string;
  order: number;
  schedules: Schedule[];
}

export interface Settings {
  timeRangeStart: string;    // "07:00"
  timeRangeEnd: string;      // "23:00"
  showWeekends: boolean;     // 토/일 표시 여부 (기본 false)
}
