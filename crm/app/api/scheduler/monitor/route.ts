import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  utcToKoreaTime, 
  formatKoreaTime, 
  debugTimeInfo 
} from '@/lib/utils/timezone';

// 크론잡 기반 스케줄러 모니터링 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceCleanup = searchParams.get('force_cleanup') === 'true';
    
    const client = getSupabase();
    const now = new Date(); // 🔥 현재 UTC 시간 사용 (정확한 시간 처리)
    
    console.log(`📊 스케줄러 모니터링 시작: ${formatKoreaTime(now)}`);
    console.log(`🔧 강제 정리 모드: ${forceCleanup ? 'ON' : 'OFF'}`);
    debugTimeInfo('모니터링 시간', now);
    
    // 모든 스케줄 작업 조회
    const { data: jobs, error: jobsError } = await client
      .from('scheduled_jobs')
      .select('*')
      .order('scheduled_time', { ascending: true });
    
    if (jobsError) {
      console.error('❌ 작업 조회 실패:', jobsError);
      return NextResponse.json({
        success: false,
        message: '작업 조회 실패: ' + jobsError.message
      }, { status: 500 });
    }
    
    // 상태별 통계 계산
    const stats = {
      total: jobs?.length || 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };
    
    // 🔥 강제 정리 실행
    let cleanupResults = [];
    if (forceCleanup && jobs) {
      console.log('\n🧹 === 강제 정리 시작 ===');
      
      for (const job of jobs) {
        if (job.status === 'running') {
          const executedAt = job.executed_at ? new Date(job.executed_at) : null;
          let shouldCleanup = false;
          let reason = '';
          
          if (executedAt) {
            // 실행 시간 계산 (타임존 고려)
            let runningMinutes: number;
            
            if (job.executed_at.includes('+09:00') || job.executed_at.includes('+0900')) {
              // 한국 시간으로 저장된 경우
              const executedTimeKST = new Date(job.executed_at);
              runningMinutes = (now.getTime() - executedTimeKST.getTime()) / (1000 * 60);
            } else {
              // UTC로 저장된 경우
              runningMinutes = (now.getTime() - executedAt.getTime()) / (1000 * 60);
            }
            
            console.log(`📋 작업 ${job.id}: ${runningMinutes.toFixed(1)}분 실행 중`);
            console.log(`📋 executed_at: ${job.executed_at}`);
            console.log(`📋 현재 시간: ${formatKoreaTime(now)}`);
            
            // 🔥 강제 정리: running 상태이면 무조건 정리 (조건 완화)
            if (runningMinutes > -60) { // -60분부터 +무한대까지 모든 경우
              shouldCleanup = true;
              reason = `강제 정리 대상 (${runningMinutes.toFixed(1)}분)`;
            }
          } else {
            // executed_at이 없는 running 상태
            shouldCleanup = true;
            reason = 'executed_at 누락';
          }
          
          if (shouldCleanup) {
            console.log(`🔧 정리: ${job.workflow_data?.name} - ${reason}`);
            
            const { error: updateError } = await client
              .from('scheduled_jobs')
              .update({
                status: 'failed',
                error_message: `강제 정리: ${reason}`,
                failed_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss'),
                updated_at: formatKoreaTime(now, 'yyyy-MM-dd HH:mm:ss')
              })
              .eq('id', job.id);
            
            if (updateError) {
              console.error(`❌ 정리 실패: ${job.id}`, updateError);
            } else {
              console.log(`✅ 정리 완료: ${job.id}`);
              job.status = 'failed'; // 로컬 객체 업데이트
              cleanupResults.push({
                id: job.id,
                workflow_name: job.workflow_data?.name,
                reason: reason
              });
            }
          }
        }
      }
      
      console.log(`🎯 정리 완료: ${cleanupResults.length}개 작업`);
    }
    
    // 🔥 간단한 시간 표시 로직: +09:00 제거하고 순수 한국시간만 표시
    const jobsWithKoreaTime = (jobs || []).map(job => {
      let scheduledTimeKST: Date;
      let createdTimeKST: Date | null = null;
      let startedTimeKST: Date | null = null;
      let completedTimeKST: Date | null = null;
      let failedTimeKST: Date | null = null;
      
      try {
        // 🔥 단순화: 저장된 시간을 그대로 Date 객체로 변환
        scheduledTimeKST = new Date(job.scheduled_time);
        
        console.log(`⚡ 시간 변환: ${job.scheduled_time} → ${scheduledTimeKST.toISOString()}`);
      } catch (error) {
        console.error(`❌ 시간 파싱 실패: ${job.scheduled_time}`, error);
        scheduledTimeKST = new Date(job.scheduled_time);
      }
      
      // 다른 시간들도 동일하게 처리
      if (job.created_at) {
        try {
          createdTimeKST = new Date(job.created_at);
        } catch {
          createdTimeKST = new Date(job.created_at);
        }
      }
      
      if (job.started_at) {
        try {
          startedTimeKST = new Date(job.started_at);
        } catch {
          startedTimeKST = new Date(job.started_at);
        }
      }
      
      if (job.completed_at) {
        try {
          completedTimeKST = new Date(job.completed_at);
        } catch {
          completedTimeKST = new Date(job.completed_at);
        }
      }
      
      if (job.failed_at) {
        try {
          failedTimeKST = new Date(job.failed_at);
        } catch {
          failedTimeKST = new Date(job.failed_at);
        }
      }
      
      // 상태별 카운트
      stats[job.status as keyof typeof stats]++;
      
      // 현재 시간과의 차이 계산
      const timeDiff = scheduledTimeKST.getTime() - now.getTime();
      const minutesDiff = Math.round(timeDiff / (1000 * 60));
      
      let timeStatus = '';
      if (job.status === 'pending') {
        if (minutesDiff > 0) {
          timeStatus = `${minutesDiff}분 후 실행 예정`;
        } else if (minutesDiff > -5) {
          timeStatus = '실행 시간 도달';
        } else {
          timeStatus = `${Math.abs(minutesDiff)}분 지연`;
        }
      } else if (job.status === 'running') {
        // 🔥 running 상태 작업의 실행 시간 계산
        if (job.executed_at) {
          const executedAt = new Date(job.executed_at);
          const runningMinutes = Math.round((now.getTime() - executedAt.getTime()) / (1000 * 60));
          timeStatus = `${runningMinutes}분 실행 중`;
        } else {
          // executed_at이 없는 경우 예정 시간 기준으로 계산
          const delayMinutes = Math.abs(minutesDiff);
          timeStatus = `${delayMinutes}분 지연 (실행 중)`;
        }
      } else if (job.status === 'completed') {
        if (job.completed_at) {
          const completedAt = new Date(job.completed_at);
          const completedMinutes = Math.round((now.getTime() - completedAt.getTime()) / (1000 * 60));
          timeStatus = `${completedMinutes}분 전 완료`;
        } else {
          timeStatus = '완료됨';
        }
      } else if (job.status === 'failed') {
        if (job.failed_at) {
          const failedAt = new Date(job.failed_at);
          const failedMinutes = Math.round((now.getTime() - failedAt.getTime()) / (1000 * 60));
          timeStatus = `${failedMinutes}분 전 실패`;
        } else {
          timeStatus = '실패됨';
        }
      }
      
      // 🔥 간단한 한국시간 포맷팅: YYYY-MM-DD HH:mm:ss 형태로 표시
      const formatSimpleKoreaTime = (date: Date) => {
        return date.toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\. /g, '-').replace(/\./g, '').replace(', ', ' ');
      };
      
      return {
        ...job,
        // 🔥 단순화된 한국 시간으로 변환 (YYYY-MM-DD HH:mm:ss 형태)
        scheduled_time_kst: formatSimpleKoreaTime(scheduledTimeKST),
        created_at_kst: createdTimeKST ? formatSimpleKoreaTime(createdTimeKST) : null,
        started_at_kst: startedTimeKST ? formatSimpleKoreaTime(startedTimeKST) : null,
        completed_at_kst: completedTimeKST ? formatSimpleKoreaTime(completedTimeKST) : null,
        failed_at_kst: failedTimeKST ? formatSimpleKoreaTime(failedTimeKST) : null,
        // 추가 정보
        time_status: timeStatus,
        minutes_diff: minutesDiff,
        workflow_name: job.workflow_data?.name || 'Unknown'
      };
    });
    
    // 임박한 작업들 (30분 이내)
    const upcomingJobs = jobsWithKoreaTime.filter(job => 
      job.status === 'pending' && 
      job.minutes_diff > 0 && 
      job.minutes_diff <= 30
    );
    
    // 지연된 작업들 (5분 이상 지연)
    const delayedJobs = jobsWithKoreaTime.filter(job => 
      job.status === 'pending' && 
      job.minutes_diff < -5
    );
    
    // 최근 완료된 작업들 (1시간 이내)
    const recentCompletedJobs = jobsWithKoreaTime.filter(job => {
      if (job.status !== 'completed' || !job.completed_at_kst) return false;
      const completedTime = new Date(job.completed_at);
      const hoursDiff = (now.getTime() - completedTime.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 1;
    });
    
    console.log(`📊 모니터링 결과: 총 ${stats.total}개 작업 (대기: ${stats.pending}, 실행중: ${stats.running}, 완료: ${stats.completed}, 실패: ${stats.failed})`);
    
    return NextResponse.json({
      success: true,
      data: {
        // 현재 시간 정보
        current_time: {
          korea_time: formatKoreaTime(now),
          utc_time: new Date().toISOString()
        },
        
        // 통계 정보
        statistics: stats,
        
        // 모든 작업 목록 (한국 시간으로 변환됨)
        jobs: jobsWithKoreaTime,
        
        // 특별 카테고리
        upcoming_jobs: upcomingJobs,
        delayed_jobs: delayedJobs,
        recent_completed_jobs: recentCompletedJobs,
        
        // 강제 정리 결과
        cleanup_results: forceCleanup ? cleanupResults : undefined,
        
        // 요약 정보
        summary: {
          total_jobs: stats.total,
          active_jobs: stats.pending + stats.running,
          upcoming_count: upcomingJobs.length,
          delayed_count: delayedJobs.length,
          recent_completed_count: recentCompletedJobs.length,
          cleaned_up_count: cleanupResults.length
        }
      },
      message: `스케줄러 상태: ${stats.pending}개 대기, ${stats.running}개 실행중${forceCleanup ? `, ${cleanupResults.length}개 정리됨` : ''}`
    });
    
  } catch (error) {
    console.error('❌ 모니터링 실패:', error);
    return NextResponse.json({
      success: false,
      message: '모니터링 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}