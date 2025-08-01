import moment from 'moment-timezone';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

/**
 * 🕐 시간대 처리 원칙:
 * - 저장: UTC로 DB 저장 (서버 환경 독립적)
 * - 입력: 사용자는 KST로 입력
 * - 출력: 사용자에게는 KST로 표시
 * - 연산: 내부 비교는 같은 시간대끼리
 * 
 * 이 파일의 모든 함수는 "저장은 UTC, 입력/출력은 KST" 원칙을 따릅니다.
 */

// 한국 시간대 상수
export const KOREA_TIMEZONE = 'Asia/Seoul';

/**
 * 현재 한국 시간을 반환
 * 🔥 사용 목적: 현재 시간을 한국 시간 기준으로 가져올 때 사용
 * 🔥 시간대 처리: 서버 환경에 관계없이 항상 한국 시간 기준 Date 객체 반환
 * 🔥 반환값: 한국 시간 기준 Date 객체 (저장 시 koreaTimeToUTCString 사용 필요)
 */
export function getKoreaTime(): Date {
  // 🔥 정확한 한국 시간 Date 객체 반환
  const koreaMoment = moment.tz(KOREA_TIMEZONE);
  
  // 🔥 문서 원칙 적용: 한국 시간 값으로 Date 객체 생성
  return new Date(
    koreaMoment.year(),
    koreaMoment.month(),
    koreaMoment.date(),
    koreaMoment.hour(),
    koreaMoment.minute(),
    koreaMoment.second(),
    koreaMoment.millisecond()
  );
}

/**
 * 현재 한국 시간을 moment 객체로 반환
 * 🔥 사용 목적: moment 기반 시간 계산이 필요할 때 사용
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
 * 🔥 사용 목적: 한국 시간대의 Date 객체를 UTC Date 객체로 변환
 * 🔥 중요: Date 객체의 시간 값을 한국 시간으로 해석하여 UTC로 변환
 * @param koreaTime 한국 시간대의 Date 객체
 */
export function koreaTimeToUTC(koreaTime: Date): Date {
  // 🔥 Date 객체의 시간 값을 한국 시간으로 해석하고 UTC로 변환
  const year = koreaTime.getFullYear();
  const month = koreaTime.getMonth();
  const date = koreaTime.getDate();
  const hours = koreaTime.getHours();
  const minutes = koreaTime.getMinutes();
  const seconds = koreaTime.getSeconds();
  const milliseconds = koreaTime.getMilliseconds();
  
  // 한국 시간대에서 해당 시간을 생성하고 UTC로 변환
  const koreaMoment = moment.tz([year, month, date, hours, minutes, seconds, milliseconds], KOREA_TIMEZONE);
  return koreaMoment.utc().toDate();
}

/**
 * UTC 시간을 한국 시간으로 변환
 * 🔥 사용 목적: DB에서 조회한 UTC 시간을 한국 시간으로 표시할 때 사용
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
 * 🔥 사용 목적: DB에 시간을 저장할 때 반드시 사용해야 하는 함수
 * 🔥 시간대 처리: 한국 시간 → UTC 변환 → ISO 문자열 반환
 * 🔥 예시: getKoreaTime() → "2025-06-27T12:00:00.000Z" (UTC)
 * @param koreaTime 한국 시간 Date 객체
 */
export function koreaTimeToUTCString(koreaTime: Date): string {
  return koreaTimeToUTC(koreaTime).toISOString();
}

/**
 * 스케줄 시간 계산 (반복 실행용)
 * 🔥 시간대 처리: 한국 시간 기준으로 다음 실행 시간을 정확히 계산
 * 🔥 반환값: 한국 시간 기준 Date 객체 (저장 시 koreaTimeToUTCString 사용 필요)
 * @param timeString "HH:mm" 형식의 시간
 * @param frequency 반복 주기
 * @param daysOfWeek 주간 반복 시 특정 요일들 (0=일요일, 1=월요일, ...)
 */
export function calculateNextKoreaScheduleTime(
  timeString: string, 
  frequency: 'daily' | 'weekly' | 'monthly' = 'daily',
  daysOfWeek?: number[]
): Date {
  const now = getKoreaMoment();
  const [hours, minutes] = timeString.split(':').map(Number);
  
  console.log(`🔍 스케줄 계산 시작:`);
  console.log(`   현재 한국 시간: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`   설정된 시간: ${timeString} (${hours}:${minutes})`);
  
  // 🔥 한국 시간대에서 오늘 해당 시간으로 설정
  let nextRun = moment.tz(KOREA_TIMEZONE)
    .year(now.year())
    .month(now.month())
    .date(now.date())
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0);
  
  console.log(`   오늘 설정 시간: ${nextRun.format('YYYY-MM-DD HH:mm:ss')}`);
  
  // 주간 반복이고 특정 요일이 지정된 경우 특별 처리
  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    console.log(`   📅 주간 반복 - 지정된 요일: ${daysOfWeek.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}`);
    
    const currentDayOfWeek = now.day(); // 0=일요일, 1=월요일, ...
    console.log(`   현재 요일: ${['일', '월', '화', '수', '목', '금', '토'][currentDayOfWeek]}요일`);
    
    // 정렬된 요일 배열
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
    
    // 오늘 이후로 가장 가까운 요일 찾기
    let targetDay = null;
    let daysToAdd = 0;
    
    // 1. 이번 주에서 가능한 요일 찾기
    for (const day of sortedDays) {
      if (day > currentDayOfWeek) {
        targetDay = day;
        daysToAdd = day - currentDayOfWeek;
        break;
      } else if (day === currentDayOfWeek) {
        // 오늘이 지정된 요일인 경우, 시간 확인
        if (nextRun.isAfter(now)) {
          targetDay = day;
          daysToAdd = 0;
          break;
        }
      }
    }
    
    // 2. 이번 주에 없으면 다음 주 첫 번째 요일로
    if (targetDay === null) {
      targetDay = sortedDays[0];
      daysToAdd = 7 - currentDayOfWeek + targetDay;
      console.log(`   이번 주 실행 시간이 지나서 다음 주 ${['일', '월', '화', '수', '목', '금', '토'][targetDay]}요일로 설정`);
    }
    
    // 날짜 조정
    nextRun = nextRun.add(daysToAdd, 'days');
    console.log(`   계산된 다음 실행 시간: ${nextRun.format('YYYY-MM-DD HH:mm:ss')} (${['일', '월', '화', '수', '목', '금', '토'][targetDay]}요일)`);
    
  } else {
    // 기존 로직: 현재 시간이 설정 시간을 지났으면 다음 주기로 설정
    if (nextRun.isSameOrBefore(now)) {
      console.log(`   ⏰ 설정 시간이 지났음, 다음 주기로 이동`);
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
      console.log(`   다음 실행 시간: ${nextRun.format('YYYY-MM-DD HH:mm:ss')}`);
    } else {
      console.log(`   ✅ 오늘 실행 예정`);
    }
  }
  
  // 🔥 문서 원칙 적용: 한국 시간 기준 Date 객체 반환 (시간 값을 한국 시간으로 해석)
  // nextRun.toDate()는 UTC Date를 반환하므로, 한국 시간 값으로 새 Date 생성
  const koreaTimeAsDate = new Date(
    nextRun.year(),
    nextRun.month(),
    nextRun.date(),
    nextRun.hour(),
    nextRun.minute(),
    nextRun.second(),
    nextRun.millisecond()
  );
  
  console.log(`🎯 최종 계산 결과:`);
  console.log(`   한국 시간: ${nextRun.format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(`   반환 Date 객체: ${koreaTimeAsDate.toISOString()}`);
  console.log(`   UTC 변환 예상: ${koreaTimeToUTC(koreaTimeAsDate).toISOString()}`);
  
  return koreaTimeAsDate;
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
 * @param daysOfWeek 주간 반복 시 특정 요일들 (0=일요일, 1=월요일, ...)
 */
export function createCronExpression(
  koreaTimeString: string, 
  frequency: 'daily' | 'weekly' | 'monthly' = 'daily',
  daysOfWeek?: number[]
): string {
  const { hour, minute } = getUTCCronTime(koreaTimeString);
  
  switch (frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      if (daysOfWeek && daysOfWeek.length > 0) {
        // 특정 요일들이 지정된 경우 (크론에서 0=일요일, 6=토요일)
        const cronDays = daysOfWeek.join(',');
        return `${minute} ${hour} * * ${cronDays}`;
      }
      return `${minute} ${hour} * * 0`; // 기본값: 매주 일요일
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