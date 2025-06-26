import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 한국 시간 (KST, UTC+9) 관련 유틸리티 함수들
 * Supabase는 UTC 시간대를 사용하므로, 한국 시간과의 변환이 필요합니다.
 */

/**
 * 현재 한국 시간을 Date 객체로 반환
 * @returns {Date} 한국 시간 (KST)
 */
export function getKoreaTime(): Date {
  const now = new Date();
  // Asia/Seoul 시간대로 변환하여 정확한 한국 시간 반환
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

/**
 * 한국 시간을 UTC ISO 문자열로 변환 (Supabase 저장용)
 * @param koreaTime - 한국 시간 Date 객체 (이미 KST로 설정된 시간)
 * @returns {string} UTC ISO 문자열
 */
export function koreaTimeToUTC(koreaTime: Date): string {
  // 더 간단한 방법: 한국 시간을 UTC로 직접 변환
  // toISOString()은 항상 UTC 기준이므로, 한국 시간 값을 그대로 사용하되
  // 시간대 오프셋을 고려하여 변환
  
  const year = koreaTime.getFullYear();
  const month = koreaTime.getMonth();
  const date = koreaTime.getDate();
  const hours = koreaTime.getHours();
  const minutes = koreaTime.getMinutes();
  const seconds = koreaTime.getSeconds();
  
  // 한국 시간을 UTC로 변환: KST는 UTC+9이므로 9시간을 빼야 함
  const utcDate = new Date(Date.UTC(year, month, date, hours - 9, minutes, seconds));
  
  return utcDate.toISOString();
}

/**
 * UTC ISO 문자열을 한국 시간으로 변환
 * @param utcString - UTC ISO 문자열
 * @returns {Date} 한국 시간 Date 객체
 */
export function utcToKoreaTime(utcString: string): Date {
  const utcTime = new Date(utcString);
  // UTC 시간에 9시간을 더해서 한국 시간으로 변환
  const koreaTime = new Date(utcTime.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime;
}

/**
 * 한국 시간 기준으로 스케줄 시간 생성
 * @param time - "HH:MM" 형식의 시간 문자열 (한국 시간 기준)
 * @param baseDate - 기준 날짜 (선택사항, 기본값: 오늘)
 * @returns {Date} 한국 시간 기준 스케줄 시간
 */
export function createKoreaScheduleTime(time: string, baseDate?: Date): Date {
  const base = baseDate || getKoreaTime();
  const [hours, minutes] = time.split(':').map(Number);
  
  // 한국 시간 기준으로 시간 설정
  const scheduleTime = new Date(base);
  scheduleTime.setHours(hours, minutes, 0, 0);
  
  return scheduleTime;
}

/**
 * 한국 시간 기준으로 날짜 문자열 포맷
 * @param date - Date 객체
 * @returns {string} "YYYY-MM-DD HH:MM:SS" 형식의 한국 시간 문자열
 */
export function formatKoreaTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
