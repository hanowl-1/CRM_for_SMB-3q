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
    const client = getSupabase();
    const now = getKoreaTime();
    
    console.log(`🔍 스케줄러 모니터링: ${formatKoreaTime(now)}`);
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
    
    // UTC로 저장된 시간을 한국 시간으로 변환하여 표시
    const jobsWithKoreaTime = (jobs || []).map(job => {
      const scheduledKoreaTime = utcToKoreaTime(new Date(job.scheduled_time));
      const createdKoreaTime = job.created_at ? utcToKoreaTime(new Date(job.created_at)) : null;
      const startedKoreaTime = job.started_at ? utcToKoreaTime(new Date(job.started_at)) : null;
      const completedKoreaTime = job.completed_at ? utcToKoreaTime(new Date(job.completed_at)) : null;
      const failedKoreaTime = job.failed_at ? utcToKoreaTime(new Date(job.failed_at)) : null;
      
      // 상태별 카운트
      stats[job.status as keyof typeof stats]++;
      
      // 현재 시간과의 차이 계산
      const timeDiff = scheduledKoreaTime.getTime() - now.getTime();
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
      }
      
      return {
        ...job,
        // 한국 시간으로 변환된 시간들
        scheduled_time_kst: formatKoreaTime(scheduledKoreaTime),
        created_at_kst: createdKoreaTime ? formatKoreaTime(createdKoreaTime) : null,
        started_at_kst: startedKoreaTime ? formatKoreaTime(startedKoreaTime) : null,
        completed_at_kst: completedKoreaTime ? formatKoreaTime(completedKoreaTime) : null,
        failed_at_kst: failedKoreaTime ? formatKoreaTime(failedKoreaTime) : null,
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
        
        // 요약 정보
        summary: {
          total_jobs: stats.total,
          active_jobs: stats.pending + stats.running,
          upcoming_count: upcomingJobs.length,
          delayed_count: delayedJobs.length,
          recent_completed_count: recentCompletedJobs.length
        }
      },
      message: `스케줄러 상태: ${stats.pending}개 대기, ${stats.running}개 실행중`
    });
    
  } catch (error) {
    console.error('❌ 모니터링 실패:', error);
    return NextResponse.json({
      success: false,
      message: '모니터링 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 