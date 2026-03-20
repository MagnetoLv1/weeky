import type { Timetable } from '@/types';
import { timeToMinutes } from './time';
import { ALL_DAYS, generateTimeLabels } from '@/components/timetable/constants';

function formatTimeLabel(time: string): string {
  const h = parseInt(time.split(':')[0], 10);
  if (h === 0) return '오전 12시';
  if (h === 12) return '오후 12시';
  if (h < 12) return `오전 ${h}시`;
  return `오후 ${h - 12}시`;
}

export function generateTimetableHtml(timetable: Timetable): string {
  const ttStart = timetable.timeRangeStart ?? '07:00';
  const ttEnd = timetable.timeRangeEnd ?? '23:00';
  const showWeekends = timetable.showWeekends ?? false;
  const days = showWeekends ? ALL_DAYS : ALL_DAYS.slice(0, 5);

  const startMin = timeToMinutes(ttStart);
  const endMin = timeToMinutes(ttEnd);
  const totalMinutes = endMin - startMin;

  // 시간 라벨 생성 (매 정시) — constants의 공유 함수 사용
  const timeLabels = generateTimeLabels(ttStart, ttEnd);

  // 요일별 스케줄 블록 HTML 생성
  function renderDaySchedules(dayIndex: number): string {
    const schedules = timetable.schedules.filter(s =>
      s.dayOfWeek.includes(dayIndex),
    );
    return schedules
      .map(s => {
        const sMin = timeToMinutes(s.startTime);
        const eMin = timeToMinutes(s.endTime);
        const top = ((sMin - startMin) / totalMinutes) * 100;
        const height = ((eMin - sMin) / totalMinutes) * 100;
        return `<div style="
          position: absolute;
          top: ${top}%;
          height: ${height}%;
          left: 2px;
          right: 2px;
          background-color: ${s.color};
          border-radius: 3px;
          padding: 2px 3px;
          overflow: hidden;
          box-sizing: border-box;
        ">
          <div style="font-size: 8px; font-weight: 700; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.title)}</div>
          ${s.subTitle ? `<div style="font-size: 6px; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.subTitle)}</div>` : ''}
        </div>`;
      })
      .join('\n');
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    page-break-inside: avoid;
  }
  .title {
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    padding: 6px 0;
    color: #111827;
    flex-shrink: 0;
  }
  .header {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    padding: 3px 0;
    flex-shrink: 0;
  }
  .header-time { width: 10%; }
  .header-day {
    flex: 1;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    color: #374151;
  }
  .grid {
    display: flex;
    flex: 1;
    min-height: 0;
    position: relative;
  }
  .time-col {
    width: 10%;
    position: relative;
    flex-shrink: 0;
  }
  .time-label {
    position: absolute;
    right: 4px;
    font-size: 7px;
    color: #9ca3af;
    transform: translateY(-5px);
  }
  .days {
    flex: 1;
    display: flex;
    position: relative;
  }
  .day-col {
    flex: 1;
    position: relative;
    border-left: 1px solid #f3f4f6;
  }
  .hour-line {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid #f3f4f6;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="title">${escapeHtml(timetable.name)}</div>
    <div class="header">
      <div class="header-time"></div>
      ${days.map(d => `<div class="header-day">${d}</div>`).join('\n')}
    </div>
    <div class="grid">
      <div class="time-col">
        ${timeLabels.map((label, i) => {
          const top = timeLabels.length > 1 ? (i / (timeLabels.length - 1)) * 100 : 0;
          return `<div class="time-label" style="top: ${top}%;">${formatTimeLabel(label)}</div>`;
        }).join('\n')}
      </div>
      <div class="days">
        ${days.map((_, dayIndex) => {
          return `<div class="day-col">
            ${timeLabels.map((_, i) => {
              const top = timeLabels.length > 1 ? (i / (timeLabels.length - 1)) * 100 : 0;
              return `<div class="hour-line" style="top: ${top}%;"></div>`;
            }).join('\n')}
            ${renderDaySchedules(dayIndex)}
          </div>`;
        }).join('\n')}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
