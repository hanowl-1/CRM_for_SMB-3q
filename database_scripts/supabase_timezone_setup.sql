-- =====================================================
-- Supabase 시간대 설정 및 한국 시간 지원 스크립트
-- 작성일: 2025.01.10
-- 목적: 한국 시간 기준으로 데이터 저장 및 조회 최적화
-- =====================================================

-- =====================================================
-- 1. 현재 시간대 설정 확인
-- =====================================================
SELECT name, setting FROM pg_settings WHERE name = 'timezone';

-- 현재 시간 확인 (UTC)
SELECT NOW() as utc_time;

-- 한국 시간으로 현재 시간 확인
SELECT NOW() AT TIME ZONE 'Asia/Seoul' as korea_time;

-- =====================================================
-- 2. 시간대 관련 유틸리티 함수 생성
-- =====================================================

-- 한국 시간을 UTC로 변환하는 함수
CREATE OR REPLACE FUNCTION korea_to_utc(korea_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  -- 입력받은 한국 시간을 UTC로 변환
  RETURN korea_time AT TIME ZONE 'Asia/Seoul' AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql;

-- UTC 시간을 한국 시간으로 변환하는 함수
CREATE OR REPLACE FUNCTION utc_to_korea(utc_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  -- UTC 시간을 한국 시간으로 변환
  RETURN utc_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul';
END;
$$ LANGUAGE plpgsql;

-- 현재 한국 시간을 반환하는 함수
CREATE OR REPLACE FUNCTION now_korea()
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW() AT TIME ZONE 'Asia/Seoul';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. scheduled_jobs 테이블에 한국 시간 뷰 생성
-- =====================================================

-- scheduled_jobs 테이블의 한국 시간 뷰
CREATE OR REPLACE VIEW scheduled_jobs_korea AS
SELECT 
  id,
  workflow_id,
  workflow_data,
  utc_to_korea(scheduled_time) as scheduled_time_kst,
  scheduled_time as scheduled_time_utc,
  status,
  utc_to_korea(created_at) as created_at_kst,
  created_at as created_at_utc,
  utc_to_korea(updated_at) as updated_at_kst,
  updated_at as updated_at_utc,
  CASE 
    WHEN executed_at IS NOT NULL THEN utc_to_korea(executed_at)
    ELSE NULL
  END as executed_at_kst,
  executed_at as executed_at_utc,
  error_message,
  retry_count,
  max_retries
FROM scheduled_jobs;

-- =====================================================
-- 4. 기존 데이터 검증 쿼리
-- =====================================================

-- 현재 scheduled_jobs 테이블의 시간 데이터 확인
SELECT 
  id,
  workflow_data->>'name' as workflow_name,
  scheduled_time as utc_time,
  scheduled_time AT TIME ZONE 'Asia/Seoul' as korea_time,
  status,
  created_at AT TIME ZONE 'Asia/Seoul' as created_at_korea
FROM scheduled_jobs 
ORDER BY scheduled_time DESC 
LIMIT 10;

-- =====================================================
-- 5. 시간대 변환 테스트
-- =====================================================

-- 테스트: 현재 시간을 다양한 형식으로 출력
SELECT 
  NOW() as current_utc,
  NOW() AT TIME ZONE 'Asia/Seoul' as current_korea,
  now_korea() as korea_function,
  EXTRACT(timezone_hour FROM NOW()) as utc_offset_hours;

-- =====================================================
-- 6. 데이터 일관성 검증
-- =====================================================

-- 시간대 불일치 데이터 찾기 (만약 있다면)
SELECT 
  id,
  workflow_data->>'name' as workflow_name,
  scheduled_time,
  scheduled_time AT TIME ZONE 'Asia/Seoul' as scheduled_time_kst,
  status,
  -- 한국 시간 기준으로 9시간 차이가 나는지 확인
  EXTRACT(epoch FROM (scheduled_time AT TIME ZONE 'Asia/Seoul' - scheduled_time)) / 3600 as hour_diff
FROM scheduled_jobs
WHERE status = 'pending'
ORDER BY scheduled_time;

-- =====================================================
-- 7. 성능 최적화를 위한 인덱스
-- =====================================================

-- 한국 시간 기준 스케줄 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_korea_time 
ON scheduled_jobs ((scheduled_time AT TIME ZONE 'Asia/Seoul'));

-- 상태와 한국 시간 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status_korea_time 
ON scheduled_jobs (status, (scheduled_time AT TIME ZONE 'Asia/Seoul'));

-- =====================================================
-- 8. 권장 사용법 주석
-- =====================================================

/*
=== 권장 사용법 ===

1. 애플리케이션에서 시간 저장 시:
   - 한국 시간을 입력받은 경우: koreaTimeToUTC() 함수로 변환 후 저장
   - UTC 시간대로 저장된 데이터는 자동으로 Supabase에서 UTC로 관리됨

2. 애플리케이션에서 시간 조회 시:
   - scheduled_jobs_korea 뷰 사용 또는
   - utcToKoreaTime() 자바스크립트 함수로 변환

3. SQL에서 직접 조회 시:
   - SELECT scheduled_time AT TIME ZONE 'Asia/Seoul' FROM scheduled_jobs;
   - 또는 scheduled_jobs_korea 뷰 사용

4. 현재 한국 시간 기준 필터링:
   - WHERE scheduled_time <= (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')

=== 예시 쿼리 ===

-- 오늘 예정된 작업 조회 (한국 시간 기준)
SELECT * FROM scheduled_jobs_korea 
WHERE DATE(scheduled_time_kst) = CURRENT_DATE;

-- 다음 1시간 내 실행 예정 작업 (한국 시간 기준)
SELECT * FROM scheduled_jobs_korea 
WHERE scheduled_time_kst BETWEEN now_korea() AND now_korea() + INTERVAL '1 hour';

*/

-- =====================================================
-- 9. 설정 완료 확인
-- =====================================================

-- 최종 확인: 시간대 함수 테스트
SELECT 
  '🕐 현재 UTC 시간' as description, NOW() as time_value
UNION ALL
SELECT 
  '🇰🇷 현재 한국 시간' as description, now_korea() as time_value
UNION ALL
SELECT 
  '✅ 시간대 설정' as description, 
  CASE 
    WHEN EXTRACT(timezone_hour FROM now_korea()) = 9 THEN '한국 시간 (UTC+9) 정상'
    ELSE '시간대 설정 확인 필요'
  END as time_value;

-- 스크립트 실행 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '🎯 Supabase 시간대 설정이 완료되었습니다!';
  RAISE NOTICE '📖 scheduled_jobs_korea 뷰를 사용하여 한국 시간 기준으로 데이터를 조회할 수 있습니다.';
  RAISE NOTICE '🔧 애플리케이션에서는 lib/utils.ts의 시간 변환 함수를 사용하세요.';
END $$; 