import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  utcToKoreaTime, 
  koreaTimeToUTCString, 
  formatKoreaTime 
} from '@/lib/utils/timezone';

// 환경별 베이스 URL 결정 함수
function getBaseUrl(request: NextRequest): string {
  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // 프로덕션 환경
  if (process.env.VERCEL_PROJECT_URL) {
    return `https://${process.env.VERCEL_PROJECT_URL}`;
  }
  
  // Vercel 환경 변수
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // 요청 헤더에서 호스트 추출
  const host = request.headers.get('host');
  if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }
  
  // 기본값
  return 'http://localhost:3000';
}

// 크론 신호 기록 함수
async function recordCronSignal(request: NextRequest, isAwsLambdaCall: boolean) {
  try {
    const supabase = getSupabase();
    
    // 요청 정보 수집
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor || realIp || null;
    
    // 신호 출처 판단
    let source = 'manual';
    if (isAwsLambdaCall) {
      source = 'aws-lambda';
    } else if (process.env.NODE_ENV === 'development') {
      source = 'development';
    }
    
    // 헤더 정보 수집 (민감 정보 제외)
    const relevantHeaders: Record<string, string> = {};
    ['user-agent', 'x-forwarded-for', 'x-real-ip', 'x-amzn-trace-id', 'x-cron-secret'].forEach(header => {
      const value = request.headers.get(header);
      if (value && header !== 'x-cron-secret') { // 시크릿은 기록하지 않음
        relevantHeaders[header] = value;
      } else if (header === 'x-cron-secret' && value) {
        relevantHeaders[header] = value ? 'present' : 'absent';
      }
    });
    
    const currentTime = formatKoreaTime(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    console.log(`🔔 크론 신호 기록: 출처=${source}, 시간=${currentTime}, IP=${ipAddress}`);
    
    const { data, error } = await supabase
      .from('cron_signals')
      .insert({
        signal_time: currentTime,
        source,
        user_agent: userAgent,
        ip_address: ipAddress,
        request_headers: relevantHeaders,
        response_status: null, // 실행 후 업데이트
        executed_jobs_count: 0, // 실행 후 업데이트
        execution_duration_ms: null, // 실행 후 업데이트
        notes: `크론 신호 수신 - ${isAwsLambdaCall ? 'AWS Lambda' : '수동 호출'}`
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ 크론 신호 기록 실패:', error);
      return null;
    }
    
    console.log(`✅ 크론 신호 기록 완료: ID=${data.id}`);
    return data.id;
  } catch (error) {
    console.error('❌ 크론 신호 기록 중 오류:', error);
    return null;
  }
}

// 크론 신호 업데이트 함수
async function updateCronSignal(signalId: string, responseStatus: number, executedJobsCount: number, durationMs: number) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('cron_signals')
      .update({
        response_status: responseStatus,
        executed_jobs_count: executedJobsCount,
        execution_duration_ms: durationMs
      })
      .eq('id', signalId);
    
    if (error) {
      console.error('❌ 크론 신호 업데이트 실패:', error);
    } else {
      console.log(`✅ 크론 신호 업데이트 완료: ID=${signalId}, 실행작업수=${executedJobsCount}, 소요시간=${durationMs}ms`);
    }
  } catch (error) {
    console.error('❌ 크론 신호 업데이트 중 오류:', error);
  }
}

// 스케줄 작업 실행 API
export async function GET(request: NextRequest) {
  const startTime = new Date();
  console.log(`\n🚀 === 스케줄러 실행 시작 (${startTime.toISOString()}) ===`);
  console.log(`📋 환경: ${process.env.NODE_ENV}`);
  console.log(`📋 User-Agent: ${request.headers.get('user-agent') || 'Unknown'}`);
  console.log(`📋 호출 경로: ${request.url}`);
  
  // 🔔 AWS Lambda 호출인지 확인 (개선된 로직)
  const userAgent = request.headers.get('user-agent') || '';
  const cronSecret = request.headers.get('x-cron-secret');
  const schedulerInternal = request.headers.get('x-scheduler-internal');
  
  const isAwsLambdaCall = !!(
    userAgent.includes('AWS-Lambda-Scheduler') ||           // AWS Lambda의 정확한 User-Agent
    userAgent.includes('aws-lambda') ||                     // 일반적인 AWS Lambda 패턴
    (cronSecret === process.env.CRON_SECRET_TOKEN &&        // 시크릿 토큰으로 AWS Lambda 확인
     schedulerInternal === 'true') ||                       // 내부 호출이면서 시크릿이 맞는 경우
    request.headers.get('x-amzn-trace-id')                  // AWS 트레이싱 헤더
  );
  
  console.log(`📋 호출 정보:`);
  console.log(`   User-Agent: ${userAgent}`);
  console.log(`   x-cron-secret: ${cronSecret ? '설정됨' : '없음'}`);
  console.log(`   x-scheduler-internal: ${schedulerInternal}`);
  console.log(`   AWS Lambda 호출: ${isAwsLambdaCall ? 'YES' : 'NO'}`);
  
  // 🔔 크론 신호 기록
  const cronSignalId = await recordCronSignal(request, isAwsLambdaCall);
  
  const debugInfo: any[] = [];
  let executedCount = 0;
  const results: any[] = [];
  
  try {
    // 인증 검증 (내부 호출인지 확인)
    const internalCall = request.headers.get('x-scheduler-internal');
    const cronSecret = request.headers.get('x-cron-secret');
    const isAuthorized = internalCall === 'true' || 
                        cronSecret === process.env.CRON_SECRET_TOKEN ||
                        process.env.NODE_ENV === 'development'; // 개발 환경에서는 인증 생략
    
    if (!isAuthorized) {
      console.warn('⚠️ 스케줄러 실행 API 무권한 접근 시도');
      return NextResponse.json({
        success: false,
        message: '권한이 없습니다.'
      }, { status: 401 });
    }
    
    const supabase = getSupabase();
    
    /**
     * 🕐 시간대 처리 원칙:
     * - 저장: UTC로 DB 저장 (서버 환경 독립적)
     * - 비교: UTC 기준으로 실행 시간 판단 (정확한 비교)
     * - 표시: 사용자에게는 KST로 표시
     */
    const now = new Date(); // 🔥 현재 UTC 시간 사용 (정확한 비교를 위해)
    const currentTimeString = formatKoreaTime(now); // 표시용은 한국시간으로
    
    console.log(`⏰ 현재 한국 시간: ${currentTimeString}`);
    
    // 🔥 멈춘 작업 복구 로직 추가 (5분 이상 running 상태인 작업들)
    console.log('\n🔧 === 멈춘 작업 복구 검사 시작 ===');
    const { data: stuckJobs, error: stuckJobsError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'running');
      
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`📋 running 상태 작업 ${stuckJobs.length}개 발견`);
      
      for (const stuckJob of stuckJobs) {
        console.log(`📋 작업 분석: ${stuckJob.id} (${stuckJob.workflow_data?.name})`);
        console.log(`   - 상태: ${stuckJob.status}`);
        console.log(`   - executed_at: ${stuckJob.executed_at}`);
        console.log(`   - created_at: ${stuckJob.created_at}`);
        
        const executedAt = stuckJob.executed_at ? new Date(stuckJob.executed_at) : null;
        
        if (executedAt) {
          const runningMinutes = (now.getTime() - executedAt.getTime()) / (1000 * 60);
          console.log(`📋 작업 ${stuckJob.id}: ${runningMinutes.toFixed(1)}분 실행 중`);
          
          // 3분 이상 running 상태면 실패로 처리 (테스트용)
          if (runningMinutes > 3) {
            console.log(`⚠️ 작업 ${stuckJob.id} 복구 시작: ${runningMinutes.toFixed(1)}분 동안 멈춤`);
            
                          const koreaTimeNow = getKoreaTime();
              const { error: updateError } = await supabase
                .from('scheduled_jobs')
                .update({
                  status: 'failed',
                  error_message: `실행 타임아웃: ${runningMinutes.toFixed(1)}분 동안 응답 없음`,
                  failed_at: formatKoreaTime(koreaTimeNow, 'yyyy-MM-dd HH:mm:ss'),
                  updated_at: formatKoreaTime(koreaTimeNow, 'yyyy-MM-dd HH:mm:ss')
                })
                .eq('id', stuckJob.id);
              
            if (updateError) {
              console.error(`❌ 작업 ${stuckJob.id} 복구 실패:`, updateError);
            } else {
              console.log(`✅ 작업 ${stuckJob.id} 복구 완료: failed 상태로 변경`);
            }
          }
        } else {
          // executed_at이 없는 running 작업은 즉시 복구
          console.log(`⚠️ 작업 ${stuckJob.id}: executed_at 없는 running 상태 - 즉시 복구`);
          
          const koreaTimeNow = getKoreaTime();
          const { error: updateError } = await supabase
            .from('scheduled_jobs')
            .update({
              status: 'failed',
              error_message: 'executed_at 누락된 비정상 running 상태',
              failed_at: formatKoreaTime(koreaTimeNow, 'yyyy-MM-dd HH:mm:ss'),
              updated_at: formatKoreaTime(koreaTimeNow, 'yyyy-MM-dd HH:mm:ss')
            })
            .eq('id', stuckJob.id);
            
          if (updateError) {
            console.error(`❌ 작업 ${stuckJob.id} 복구 실패:`, updateError);
          } else {
            console.log(`✅ 작업 ${stuckJob.id} 복구 완료: failed 상태로 변경`);
          }
        }
      }
    } else {
      console.log('📋 멈춘 running 작업 없음');
    }
    
    // pending 상태인 스케줄 작업 조회
    const { data: jobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true });
    
    console.log(`📋 조회된 pending 작업 수: ${jobs?.length || 0}개`);
    
    if (error) {
      console.error('❌ 작업 조회 실패:', error);
      throw error;
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('📋 pending 상태인 작업이 없습니다.');
      
      // 🔔 크론 신호 업데이트
      if (cronSignalId) {
        await updateCronSignal(cronSignalId, 200, 0, (new Date().getTime() - startTime.getTime()));
      }
      
      return NextResponse.json({
        success: true,
        data: {
          executedCount: 0,
          results: [],
          debugInfo: [],
          message: '실행할 작업이 없습니다.',
          totalPendingJobs: 0,
          environment: process.env.NODE_ENV,
          baseUrl: getBaseUrl(request),
          timestamp: currentTimeString,
          awsLambdaCall: isAwsLambdaCall
        }
      });
    }
    
    // 실행할 작업 목록
    let jobsToExecute: typeof jobs = [];

    // 각 작업에 대해 실행 시간 체크
    for (const job of jobs || []) {
      console.log(`\n--- 작업 분석: ${job.id} ---`);
      console.log(`📋 워크플로우명: ${job.workflow_data?.name || 'Unknown'}`);
      console.log(`📋 예정시간(원본): ${job.scheduled_time}`);
      console.log(`📋 생성시간: ${job.created_at}`);
      console.log(`📋 상태: ${job.status}`);
      
      // 🔥 스마트 시간 해석: UTC/KST 형식 자동 감지 (모니터링 API와 동일한 로직)
      let scheduledTimeKST: Date;
      
      try {
        const storedTimeString = job.scheduled_time;
        
        // 타임존이 포함된 ISO 문자열인지 확인 (+09:00, Z 등)
        if (storedTimeString.includes('+09:00') || storedTimeString.includes('+0900')) {
          // 한국 타임존이 포함된 경우: 직접 Date 생성자로 파싱하여 정확한 UTC 시간 획득
          scheduledTimeKST = new Date(storedTimeString);
          console.log(`⚡ 타임존 포함 - 직접 파싱: ${storedTimeString} → UTC ${scheduledTimeKST.toISOString()}`);
        } else if (storedTimeString.includes('Z')) {
          // UTC 타임존이 포함된 경우: UTC로 해석하고 한국시간으로 변환
          const storedTime = new Date(storedTimeString);
          scheduledTimeKST = utcToKoreaTime(storedTime);
          console.log(`⚡ UTC 타임존 - UTC→KST 변환: ${storedTimeString} → ${formatKoreaTime(scheduledTimeKST)}`);
        } else {
          // 타임존이 없는 경우: 기존 스마트 감지 로직 적용
          const storedTime = new Date(storedTimeString);
          
          // 생성 시간이 최근(24시간 이내)이면 새 형식(KST 저장)으로 간주
          const createdAt = new Date(job.created_at || job.scheduled_time);
          const isRecentData = (now.getTime() - createdAt.getTime()) < (24 * 60 * 60 * 1000);
          
          console.log(`📋 데이터 생성일시: ${createdAt.toISOString()}`);
          console.log(`📋 최근 데이터 여부 (24시간 이내): ${isRecentData}`);
          
          if (isRecentData) {
            // 새 데이터: 한국시간으로 저장됨
            scheduledTimeKST = storedTime;
            console.log(`⚡ 최근 데이터 - KST 직접 해석: ${storedTimeString} → ${formatKoreaTime(scheduledTimeKST)}`);
          } else {
            // 기존 데이터: UTC/KST 자동 감지
            const utcInterpretation = utcToKoreaTime(storedTime);
            const directInterpretation = storedTime;
            
            const utcDiffHours = Math.abs(now.getTime() - utcInterpretation.getTime()) / (1000 * 60 * 60);
            const directDiffHours = Math.abs(now.getTime() - directInterpretation.getTime()) / (1000 * 60 * 60);
            
            console.log(`📋 UTC 해석 시간차: ${utcDiffHours.toFixed(2)}시간`);
            console.log(`📋 직접 해석 시간차: ${directDiffHours.toFixed(2)}시간`);
            
            if (utcDiffHours < directDiffHours && utcDiffHours < 24) {
              scheduledTimeKST = utcInterpretation;
              console.log(`⚡ 기존 데이터 - UTC 해석: ${storedTimeString} → ${formatKoreaTime(scheduledTimeKST)}`);
            } else {
              scheduledTimeKST = directInterpretation;
              console.log(`⚡ 기존 데이터 - KST 해석: ${storedTimeString} → ${formatKoreaTime(scheduledTimeKST)}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ 시간 파싱 실패: ${job.scheduled_time}`, error);
        scheduledTimeKST = new Date(job.scheduled_time);
      }
      
      // 시간 차이 계산 (초 단위)
      const timeDiffSeconds = Math.floor((now.getTime() - scheduledTimeKST.getTime()) / 1000);
      
      // 🔥 허용 오차를 1분으로 축소 - 정확한 실행 시간 보장 및 중복 실행 방지
      const TOLERANCE_MS = 1 * 60 * 1000; // 1분 = 60초 (기존 10분에서 축소)
      const isTimeToExecute = now.getTime() >= (scheduledTimeKST.getTime() - TOLERANCE_MS);
      
      debugInfo.push({
        id: job.id,
        workflow_name: job.workflow_data?.name || 'Unknown',
        scheduled_time_stored: job.scheduled_time,
        scheduled_time_interpreted: formatKoreaTime(scheduledTimeKST),
        status: job.status,
        timeDiffSeconds,
        isTimeToExecute
      });
      
      if (isTimeToExecute) {
        console.log(`✅ 실행 대상 추가: ${job.workflow_data?.name} (${job.id})`);
        jobsToExecute.push(job);
      } else {
        const remainingSeconds = Math.abs(timeDiffSeconds);
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        console.log(`⏸️ 대기: ${job.workflow_data?.name} (${remainingMinutes}분 ${remainingSeconds % 60}초 남음)`);
      }
    }
    
    console.log(`\n🎯 최종 실행 대상: ${jobsToExecute.length}개`);
    console.log(`📋 전체 pending 작업: ${jobs?.length || 0}개`);

    // 🔥 중복 실행 방지: 실행 대상 작업들을 즉시 running 상태로 변경
    if (jobsToExecute.length > 0) {
      console.log(`🔒 중복 실행 방지: ${jobsToExecute.length}개 작업을 running 상태로 변경`);
      
      const jobIdsToExecute = jobsToExecute.map(job => job.id);
      const koreaTime = getKoreaTime(); // 🔥 정확한 한국 시간 사용
      const currentKstTime = formatKoreaTime(koreaTime, 'yyyy-MM-dd HH:mm:ss');
      
      const { data: updatedJobs, error: updateError } = await supabase
        .from('scheduled_jobs')
        .update({
          status: 'running',
          executed_at: `${currentKstTime}+09:00`,
          updated_at: `${currentKstTime}+09:00`
        })
        .in('id', jobIdsToExecute)
        .eq('status', 'pending') // 🔥 pending 상태인 것만 업데이트 (다른 프로세스에서 이미 처리 중일 수 있음)
        .select();
        
      if (updateError) {
        console.error('❌ 작업 상태 업데이트 실패:', updateError);
        return NextResponse.json({
          success: false,
          message: '작업 상태 업데이트 실패: ' + updateError.message,
          error: updateError
        }, { status: 500 });
      }
      
      const actuallyUpdated = updatedJobs?.length || 0;
      console.log(`✅ ${actuallyUpdated}/${jobsToExecute.length}개 작업 상태 업데이트 완료`);
      
      // 🔥 실제로 업데이트된 작업만 실행 (다른 프로세스에서 이미 처리한 것 제외)
      const validJobsToExecute = jobsToExecute.filter(job => 
        updatedJobs?.some(updated => updated.id === job.id)
      );
      
      console.log(`🎯 실제 실행할 작업: ${validJobsToExecute.length}개`);
      jobsToExecute = validJobsToExecute; // 🔥 실행 목록 업데이트
    }
    
    // 🔥 실행할 작업이 없는 경우 조기 종료
    if (jobsToExecute.length === 0) {
      console.log('⏸️ 현재 실행할 작업이 없습니다.');
      
      // 🔔 크론 신호 업데이트
      if (cronSignalId) {
        await updateCronSignal(cronSignalId, 200, 0, (new Date().getTime() - startTime.getTime()));
      }
      
      return NextResponse.json({
        success: true,
        data: {
          executedCount: 0,
          results: [],
          debugInfo,
          message: '실행할 작업이 없습니다.',
          totalPendingJobs: jobs?.length || 0,
          environment: process.env.NODE_ENV,
          baseUrl: getBaseUrl(request),
          timestamp: currentTimeString,
          awsLambdaCall: isAwsLambdaCall
        }
      });
    }
    
    // 작업 실행
    console.log(`\n🚀 === 작업 실행 시작 (${jobsToExecute.length}개) ===`);
    
    for (const job of jobsToExecute) {
      try {
        console.log(`\n--- 작업 ${job.id} 실행 시작 ---`);
        console.log('작업 타입:', job.job_type);
        console.log('워크플로우 ID:', job.workflow_id);
        console.log('예정 시간:', job.scheduled_time);
        console.log('상태:', job.status);
        
        // 🔥 실행 시작 상태로 업데이트
        console.log(`🚀 실행 시작 상태 업데이트: ${job.id}`);
        // 🔥 정확한 한국 시간 사용
        const koreaTime = getKoreaTime();
        const year = koreaTime.getFullYear();
        const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
        const day = String(koreaTime.getDate()).padStart(2, '0');
        const hours = String(koreaTime.getHours()).padStart(2, '0');
        const minutes = String(koreaTime.getMinutes()).padStart(2, '0');
        const seconds = String(koreaTime.getSeconds()).padStart(2, '0');
        const kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
        
        await getSupabase()
          .from('scheduled_jobs')
          .update({ 
            status: 'running',
            // executed_at은 이미 404번 라인에서 설정됨 (중복 방지)
            updated_at: kstTimeString // 🔥 한국시간대를 명시한 문자열
          })
          .eq('id', job.id);
        
        // 🔥 워크플로우 전체 정보 조회 (실행 API가 workflow 객체를 요구하므로)
        console.log('📋 워크플로우 정보 조회 중...');
        const { data: workflowData, error: workflowError } = await getSupabase()
          .from('workflows')
          .select('*')
          .eq('id', job.workflow_id)
          .single();
        
        if (workflowError || !workflowData) {
          console.error('워크플로우 조회 실패:', workflowError);
          
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: `워크플로우 조회 실패: ${workflowError?.message || '워크플로우를 찾을 수 없음'}`,
              retry_count: (job.retry_count || 0) + 1,
              updated_at: kstTimeString // 🔥 한국시간대를 명시한 문자열
            })
            .eq('id', job.id);
          
          results.push({
            jobId: job.id,
            success: false,
            error: `워크플로우 조회 실패: ${workflowError?.message || '워크플로우를 찾을 수 없음'}`
          });
          continue;
        }
        
        console.log('✅ 워크플로우 정보 조회 완료:', workflowData.name);
        
        // 🔥 워크플로우 상태 확인: paused 또는 archived 상태면 실행하지 않음
        if (workflowData.status !== 'active') {
          console.log(`⏸️ 워크플로우가 비활성 상태여서 실행 건너뜀: ${workflowData.name} (상태: ${workflowData.status})`);
          
          // 스케줄 작업을 cancelled 상태로 변경
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'cancelled',
              error_message: `워크플로우가 ${workflowData.status} 상태로 변경되어 실행 취소됨`,
              updated_at: kstTimeString
            })
            .eq('id', job.id);
          
          results.push({
            jobId: job.id,
            success: false,
            error: `워크플로우가 ${workflowData.status} 상태로 실행 취소됨`
          });
          continue;
        }
        
        console.log(`✅ 워크플로우 활성 상태 확인됨: ${workflowData.name} (${workflowData.status})`);
        
        // 🔥 Supabase 워크플로우 데이터를 표준 Workflow 객체로 변환
        const workflow = {
          id: workflowData.id,
          name: workflowData.name,
          description: workflowData.description || '',
          status: workflowData.status,
          trigger: workflowData.trigger_config || { type: 'manual', name: '수동 실행' },
          targetGroups: workflowData.target_config?.targetGroups || [],
          targetTemplateMappings: workflowData.target_config?.targetTemplateMappings || [],
          steps: workflowData.message_config?.steps || [],
          testSettings: workflowData.variables?.testSettings || { enableRealSending: false },
          scheduleSettings: workflowData.schedule_config || { type: 'immediate' },
          stats: workflowData.statistics || { totalRuns: 0, successRate: 0 },
          createdAt: workflowData.created_at,
          updatedAt: workflowData.updated_at,
          // 🔥 스케줄 실행을 위한 추가 정보
          target_config: workflowData.target_config,
          message_config: workflowData.message_config,
          variables: workflowData.variables,
          // 🔥 웹훅 정보 추가 (누락되었던 부분!)
          trigger_type: workflowData.trigger_type,
          webhook_trigger: workflowData.webhook_trigger
        };
        
        console.log('📤 변환된 워크플로우 객체:', {
          id: workflow.id,
          name: workflow.name,
          targetGroupsCount: workflow.targetGroups.length,
          stepsCount: workflow.steps.length,
          enableRealSending: workflow.testSettings?.enableRealSending || workflow.variables?.testSettings?.enableRealSending
        });
        
        // 워크플로우 실행 API 호출
        const baseUrl = getBaseUrl(request);
        const executeUrl = `${baseUrl}/api/workflow/execute`;
        
        // 인증 헤더 추가
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'x-scheduler-internal': 'true',
          'x-cron-secret': process.env.CRON_SECRET_TOKEN || '',
          // Vercel Protection Bypass 헤더 추가
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
          'x-vercel-set-bypass-cookie': 'true'
        };
        
        console.log(`📡 워크플로우 실행 API 호출: ${executeUrl}`);
        
        const response = await fetch(executeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            workflowId: workflow.id,
            workflow: workflow,
            scheduledExecution: true,
            scheduledJobId: job.id,
            // 🔥 스케줄러 실행 시 실제 메시지 발송 활성화
            enableRealSending: true
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('워크플로우 실행 실패:', response.status, errorText);
          
          // 🔥 실행 실패시 상태를 failed로 변경
          const failureKoreaTime = getKoreaTime();
          const failureKstString = `${failureKoreaTime.getFullYear()}-${String(failureKoreaTime.getMonth() + 1).padStart(2, '0')}-${String(failureKoreaTime.getDate()).padStart(2, '0')} ${String(failureKoreaTime.getHours()).padStart(2, '0')}:${String(failureKoreaTime.getMinutes()).padStart(2, '0')}:${String(failureKoreaTime.getSeconds()).padStart(2, '0')}+09:00`;
          
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: `HTTP ${response.status}: ${errorText}`,
              retry_count: (job.retry_count || 0) + 1,
              updated_at: failureKstString // 🔥 정확한 한국시간대 문자열
            })
            .eq('id', job.id);
          
          // HTTP 401 오류인 경우 특별히 처리
          if (response.status === 401) {
            console.error('🚨 Vercel 인증 오류 발생. CRON_SECRET_TOKEN 환경 변수를 확인하세요.');
          }
          
          results.push({
            jobId: job.id,
            success: false,
            error: `HTTP ${response.status}: ${errorText}`
          });
          continue;
        }
        
        const result = await response.json();
        console.log('워크플로우 실행 결과:', result);
        
        // 🔥 워크플로우 실행 API에서 스케줄 잡 상태를 completed로 업데이트하므로 여기서는 처리하지 않음
        console.log(`✅ 작업 ${job.id} 실행 완료 - 상태 업데이트는 워크플로우 실행 API에서 처리됨`);
        
        executedCount++;
        results.push({
          jobId: job.id,
          success: true,
          result
        });
        
        // 🔥 성공 시 상태 업데이트
        console.log(`✅ 실행 완료 상태 업데이트: ${job.id}`);
        // 🔥 정확한 한국 시간 사용
        const completionTime = getKoreaTime();
        const cYear = completionTime.getFullYear();
        const cMonth = String(completionTime.getMonth() + 1).padStart(2, '0');
        const cDay = String(completionTime.getDate()).padStart(2, '0');
        const cHours = String(completionTime.getHours()).padStart(2, '0');
        const cMinutes = String(completionTime.getMinutes()).padStart(2, '0');
        const cSeconds = String(completionTime.getSeconds()).padStart(2, '0');
        const kstCompletionString = `${cYear}-${cMonth}-${cDay} ${cHours}:${cMinutes}:${cSeconds}+09:00`;
        
        await getSupabase()
          .from('scheduled_jobs')
          .update({ 
            status: 'completed',
            completed_at: kstCompletionString, // 🔥 한국시간대를 명시한 문자열
            updated_at: kstCompletionString // 🔥 한국시간대를 명시한 문자열
          })
          .eq('id', job.id);
        
      } catch (error) {
        console.error(`❌ 작업 실행 실패: ${job.id}`, error);
        // 🔥 정확한 한국 시간 사용
        const failureTime = getKoreaTime();
        const fYear = failureTime.getFullYear();
        const fMonth = String(failureTime.getMonth() + 1).padStart(2, '0');
        const fDay = String(failureTime.getDate()).padStart(2, '0');
        const fHours = String(failureTime.getHours()).padStart(2, '0');
        const fMinutes = String(failureTime.getMinutes()).padStart(2, '0');
        const fSeconds = String(failureTime.getSeconds()).padStart(2, '0');
        const kstFailureString = `${fYear}-${fMonth}-${fDay} ${fHours}:${fMinutes}:${fSeconds}+09:00`;
        
        if (job.retry_count < job.max_retries) {
          console.log(`🔄 재시도 시도: ${job.retry_count + 1}/${job.max_retries}`);
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'pending', // 재시도를 위해 pending 상태로 변경
              retry_count: job.retry_count + 1,
              error_message: error instanceof Error ? error.message : '알 수 없는 오류',
              updated_at: kstFailureString // 🔥 한국시간대를 명시한 문자열
            })
            .eq('id', job.id);
        } else {
          console.log(`💀 최대 재시도 횟수 초과, 실패 처리`);
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: error instanceof Error ? error.message : '알 수 없는 오류',
              failed_at: kstFailureString, // 🔥 한국시간대를 명시한 문자열
              updated_at: kstFailureString // 🔥 한국시간대를 명시한 문자열
            })
            .eq('id', job.id);
        }
        
        results.push({
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    console.log(`\n🎯 스케줄 실행 완료: ${executedCount}개 실행, ${results.filter(r => !r.success).length}개 실패`);
    
    // 🔔 크론 신호 업데이트
    if (cronSignalId) {
      await updateCronSignal(cronSignalId, 200, executedCount, (new Date().getTime() - startTime.getTime()));
    }
    
    return NextResponse.json({
      success: true,
      data: {
        executedCount,
        results,
        debugInfo,
        totalJobs: jobsToExecute.length,
        environment: process.env.NODE_ENV,
        baseUrl: getBaseUrl(request)
      },
      message: `${executedCount}개의 작업이 실행되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ 스케줄 실행기 오류:', error);
    
    // 🔔 크론 신호 업데이트 (에러 상태)
    if (cronSignalId) {
      await updateCronSignal(cronSignalId, 500, executedCount, (new Date().getTime() - startTime.getTime()));
    }
    
    return NextResponse.json({
      success: false,
      message: '스케줄 실행기 오류: ' + (error instanceof Error ? error.message : String(error)),
      environment: process.env.NODE_ENV,
      baseUrl: getBaseUrl(request)
    }, { status: 500 });
  }
}

// POST 방식도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request);
} 