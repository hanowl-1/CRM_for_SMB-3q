import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 새로운 전문적인 시간대 처리 시스템을 사용
// 기존 함수들은 하위 호환성을 위해 새 시스템으로 리디렉션
export {
  getKoreaTime,
  koreaTimeToUTCString as koreaTimeToUTC,
  utcToKoreaTime,
  createKoreaDateTime as createKoreaScheduleTime,
  formatKoreaTime
} from './utils/timezone';
