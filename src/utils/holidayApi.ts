import type { HolidayInfo } from '@/types';

const SERVICE_KEY =
    '23a27397be76a729a58cd6e4b929a6f28b861de22b44432f919214ee632de1c9';

const BASE_URL =
    'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

/**
 * 특정 연도/월의 공휴일 목록 조회
 * isHoliday=Y 항목만 필터링하여 반환
 */
async function fetchHolidaysForMonth(
    year: number,
    month: number,
): Promise<HolidayInfo[]> {
    const params = new URLSearchParams({
        ServiceKey: SERVICE_KEY,
        solYear: String(year),
        solMonth: String(month).padStart(2, '0'),
        _type: 'json',
        numOfRows: '50', // 월별 공휴일은 최대 5개 수준이나 여유 있게 설정
    });

    const url = `${BASE_URL}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const json = await response.json();
    const body = json?.response?.body;
    if (!body || body.totalCount === 0) return [];

    // totalCount=1이면 단일 객체, 이상이면 배열
    const items = body.items?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];

    return list
        .filter((item: { isHoliday: string }) => item.isHoliday === 'Y')
        .map(
            (item: { locdate: number; dateName: string }) =>
                ({
                    // locdate는 숫자 20260101 형태
                    date: String(item.locdate),
                    dateName: item.dateName,
                }) as HolidayInfo,
        );
}

/**
 * 해당 연도의 12개월 공휴일 전체를 병렬 요청으로 수집
 * API 실패 시 빈 배열 반환 (앱 동작에 영향 없음)
 */
export async function fetchHolidaysForYear(
    year: number,
): Promise<HolidayInfo[]> {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const results = await Promise.all(
        months.map(month =>
            fetchHolidaysForMonth(year, month).catch(() => [] as HolidayInfo[]),
        ),
    );
    return results.flat();
}
