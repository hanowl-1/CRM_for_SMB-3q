import moment from 'moment-timezone';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

// 한국 시간대 상수
export const KOREA_TIMEZONE = 'Asia/Seoul';

/**
 * 현재 한국 시간을 반환
 */
export function getKoreaTime(): Date {
  return moment.tz(KOREA_TIMEZONE).toDate();
}

/**
 * 현재 한국 시간을 moment 객체로 반환
 */
export function getKoreaMoment() {
  return moment.tz(KOREA_TIMEZONE);
}

/**
 * 한국 시간 문자열을 Date 객체로 변환
 * @param timeString "HH:mm" 형식의 시간 문자열
 * @param date 기준 날짜 (기본값: 오늘)
 */
export function createKoreaDateTime(timeString: string, date?: Date): Date {
  const baseDate = date || getKoreaTime();
  const [hours, minutes] = timeString.split(':').map(Number);
  
  return moment.tz(KOREA_TIMEZONE)
    .year(baseDate.getFullYear())
    .month(baseDate.getMonth())
    .date(baseDate.getDate())
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0)
    .toDate();
}

/**
 * 한국 시간을 UTC로 변환
 * @param koreaTime 한국 시간 Date 객체
 */
export function koreaTimeToUTC(koreaTime: Date): Date {
  return fromZonedTime(koreaTime, KOREA_TIMEZONE);
}

/**
 * UTC 시간을 한국 시간으로 변환
 * @param utcTime UTC 시간 Date 객체
 */
export function utcToKoreaTime(utcTime: Date): Date {
  return toZonedTime(utcTime, KOREA_TIMEZONE);
}

/**
 * 한국 시간을 포맷된 문자열로 반환
 * @param date Date 객체
 * @param formatString 포맷 문자열 (기본값: 'yyyy-MM-dd HH:mm:ss')
 */
export function formatKoreaTime(date: Date, formatString: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return format(toZonedTime(date, KOREA_TIMEZONE), formatString, { timeZone: KOREA_TIMEZONE });
}

/**
 * 한국 시간을 ISO 문자열로 변환 (KST 타임존 포함)
 * @param date Date 객체
 */
export function toKoreaISOString(date: Date): string {
  const koreaTime = toZonedTime(date, KOREA_TIMEZONE);
  return format(koreaTime, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", { timeZone: KOREA_TIMEZONE });
}

/**
 * 한국 시간을 UTC ISO 문자열로 변환 (DB 저장용)
 * @param koreaTime 한국 시간 Date 객체
 */
export function koreaTimeToUTCString(koreaTime: Date): string {
  return koreaTimeToUTC(koreaTime).toISOString();
}

/**
 * 스케줄 시간 계산 (반복 실행용)
 * @param timeString "HH:mm" 형식의 시간
 * @param frequency 반복 주기
 */
export function calculateNextKoreaScheduleTime(timeString: string, frequency: 'daily' | 'weekly' | 'monthly' = 'daily'): Date {
  const now = getKoreaMoment();
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // 오늘 해당 시간으로 설정
  let nextRun = now.clone().hour(hours).minute(minutes).second(0).millisecond(0);
  
  // 현재 시간이 설정 시간을 지났으면 다음 주기로 설정
  if (nextRun.isSameOrBefore(now)) {
    switch (frequency) {
      case 'daily':
        nextRun = nextRun.add(1, 'day');
        break;
      case 'weekly':
        nextRun = nextRun.add(1, 'week');
        break;
      case 'monthly':
        nextRun = nextRun.add(1, 'month');
        break;
    }
  }
  
  return nextRun.toDate();
}

/**
 * 크론 표현식을 위한 UTC 시간 계산
 * @param koreaTimeString "HH:mm" 형식의 한국 시간
 */
export function getUTCCronTime(koreaTimeString: string): { hour: number; minute: number } {
  const [koreaHour, koreaMinute] = koreaTimeString.split(':').map(Number);
  
  // 한국 시간을 UTC로 변환
  const koreaTime = moment.tz(KOREA_TIMEZONE).hour(koreaHour).minute(koreaMinute);
  const utcTime = koreaTime.utc();
  
  return {
    hour: utcTime.hour(),
    minute: utcTime.minute()
  };
}

/**
 * 크론 표현식 생성 (UTC 기준)
 * @param koreaTimeString "HH:mm" 형식의 한국 시간
 * @param frequency 반복 주기
 */
export function createCronExpression(koreaTimeString: string, frequency: 'daily' | 'weekly' | 'monthly' = 'daily'): string {
  const { hour, minute } = getUTCCronTime(koreaTimeString);
  
  switch (frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * 0`; // 매주 일요일
    case 'monthly':
      return `${minute} ${hour} 1 * *`; // 매월 1일
    default:
      return `${minute} ${hour} * * *`;
  }
}

/**
 * 디버깅용 시간 정보 출력
 */
export function debugTimeInfo(label: string, date: Date) {
  const koreaTime = toZonedTime(date, KOREA_TIMEZONE);
  const utcTime = date;
  
  console.log(`🕐 ${label}:`);
  console.log(`   한국 시간: ${formatKoreaTime(koreaTime)}`);
  console.log(`   UTC 시간: ${utcTime.toISOString()}`);
  console.log(`   KST ISO: ${toKoreaISOString(koreaTime)}`);
  console.log(`   UTC ISO: ${koreaTimeToUTCString(koreaTime)}`);
} 