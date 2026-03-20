// 시간표 컴포넌트 공유 상수 및 헬퍼 함수
import { Dimensions } from 'react-native';
import { timeToMinutes } from '@/utils/time';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

export const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export const TIME_COL_WIDTH = 58;
export const MIN_CELL_HEIGHT = 1.5; // 10분 = 1.5dp
export const SCREEN_WIDTH = Dimensions.get('window').width;
export const ZOOM_DURATION = 250;
export const SLIDE_DURATION = 300;

// 오늘 요일 인덱스 (월=0 ~ 일=6)
export function getTodayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

// 시작~종료 시간 사이 정시(00분) 라벨 배열 생성
export function generateTimeLabels(start: string, end: string): string[] {
  const labels: string[] = [];
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  for (let m = startMin; m <= endMin; m += 60) {
    const h = Math.floor(m / 60);
    labels.push(`${String(h).padStart(2, '0')}:00`);
  }
  return labels;
}

// "HH:00" 라벨을 오전/오후 + 시 숫자로 변환
export function formatTimeLabel(label: string): { ampm: string; hour: number } {
  const h = parseInt(label.split(':')[0], 10);
  if (h === 0) return { ampm: '오전', hour: 12 };
  if (h === 12) return { ampm: '오후', hour: 12 };
  if (h < 12) return { ampm: '오전', hour: h };
  return { ampm: '오후', hour: h - 12 };
}

// 햅틱 피드백 (드래그 시작·종료 등)
export function triggerHaptic() {
  ReactNativeHapticFeedback.trigger('impactMedium', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
}
