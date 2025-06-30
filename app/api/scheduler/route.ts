import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/supabase-client';
import { getKoreaTime, formatKoreaTime, utcToKoreaTime } from '@/lib/utils/timezone';

// 스케줄러 상태 조회
export async function GET(request: NextRequest) {
  try {
    const client = getSupabase();
    const now = getKoreaTime();

    // scheduled_jobs 테이블에서 상태별 작업 수 조회
    const { data: jobs, error } = await client
      .from('scheduled_jobs')
      .select('id, status, scheduled_time, workflow_data, created_at')
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('❌ 스케줄 작업 조회 실패:', error);
      return NextResponse.json({
        success: false,
        message: '스케줄 작업 조회에 실패했습니다: ' + error.message
      }, { status: 500 });
    }

    // 상태별 집계
    const statusCounts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    const upcomingJobs = [];
    const recentJobs = [];

    jobs?.forEach(job => {
      statusCounts[job.status as keyof typeof statusCounts]++;
      
      // 🔥 스마트 시간 해석: UTC/KST 형식 자동 감지 (실행 API와 동일한 로직)
      let scheduledTimeKST: Date;
      
      try {
        const storedTime = new Date(job.scheduled_time);
        
        // 생성 시간이 최근(24시간 이내)이면 새 형식(KST 저장)으로 간주
        const createdAt = new Date(job.created_at || job.scheduled_time);
        const isRecentData = (now.getTime() - createdAt.getTime()) < (24 * 60 * 60 * 1000);
        
        if (isRecentData) {
          // 새 데이터: 한국시간으로 저장됨
          scheduledTimeKST = storedTime;
        } else {
          // 기존 데이터: UTC/KST 자동 감지
          const utcInterpretation = utcToKoreaTime(storedTime);
          const directInterpretation = storedTime;
          
          const utcDiffHours = Math.abs(now.getTime() - utcInterpretation.getTime()) / (1000 * 60 * 60);
          const directDiffHours = Math.abs(now.getTime() - directInterpretation.getTime()) / (1000 * 60 * 60);
          
          if (utcDiffHours < directDiffHours && utcDiffHours < 24) {
            scheduledTimeKST = utcInterpretation;
          } else {
            scheduledTimeKST = directInterpretation;
          }
        }
      } catch (error) {
        console.error(`시간 파싱 오류 (${job.id}):`, error);
        scheduledTimeKST = new Date(job.scheduled_time);
      }
      
      if (job.status === 'pending') {
        const timeDiff = scheduledTimeKST.getTime() - now.getTime();
        const isOverdue = timeDiff < 0;
        
        upcomingJobs.push({
          ...job,
          workflowName: job.workflow_data?.name || 'Unknown',
          timeUntil: Math.round(timeDiff / 60000), // 분 단위 (음수면 지연)
          isOverdue: isOverdue
        });
      }
      
      if (['completed', 'failed'].includes(job.status)) {
        recentJobs.push({
          ...job,
          workflowName: job.workflow_data?.name || 'Unknown'
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        currentTime: now.toISOString(),
        statusCounts,
        upcomingJobs: upcomingJobs.slice(0, 10), // 최대 10개
        recentJobs: recentJobs.slice(-10), // 최근 10개
        totalJobs: jobs?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ 스케줄러 상태 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '스케줄러 상태 조회 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}

// 크론잡 기반 스케줄러 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    const client = getSupabase();
    const now = getKoreaTime();

    console.log(`📋 스케줄러 액션: ${action}`, data);

    switch (action) {
      case 'cancel_workflow_schedule': {
        const { workflowId } = data;
        
        if (!workflowId) {
          return NextResponse.json({
            success: false,
            message: 'workflowId가 필요합니다.'
          }, { status: 400 });
        }

        // 해당 워크플로우의 pending 작업들 취소
        const { data: cancelledJobs, error } = await client
          .from('scheduled_jobs')
          .update({ 
            status: 'cancelled',
            updated_at: now.toISOString()
          })
          .eq('workflow_id', workflowId)
          .eq('status', 'pending')
          .select();

        if (error) {
          console.error('❌ 워크플로우 스케줄 취소 실패:', error);
          return NextResponse.json({
            success: false,
            message: '워크플로우 스케줄 취소에 실패했습니다: ' + error.message
          }, { status: 500 });
        }

        const cancelledCount = cancelledJobs?.length || 0;
        
        console.log(`✅ 워크플로우 ${workflowId} 스케줄 취소 완료: ${cancelledCount}개 작업`);
        
        return NextResponse.json({
          success: true,
          data: { 
            cancelledCount,
            message: `${cancelledCount}개의 예약된 작업이 취소되었습니다.`
          },
          message: `워크플로우의 예약된 작업들이 취소되었습니다.`
        });
      }

      case 'cleanup_test_jobs': {
        // 테스트 작업들 정리 (이름에 "테스트"가 포함된 작업들)
        const { data: cleanedJobs, error } = await client
          .from('scheduled_jobs')
          .update({ 
            status: 'cancelled',
            updated_at: now.toISOString()
          })
          .like('workflow_data->name', '%테스트%')
          .in('status', ['pending', 'running'])
          .select();

        if (error) {
          console.error('❌ 테스트 작업 정리 실패:', error);
          return NextResponse.json({
            success: false,
            message: '테스트 작업 정리에 실패했습니다: ' + error.message
          }, { status: 500 });
        }

        const cleanedCount = cleanedJobs?.length || 0;
        
        return NextResponse.json({
          success: true,
          data: { cleanedCount },
          message: `${cleanedCount}개의 테스트 작업이 정리되었습니다.`
        });
      }

      case 'reset_all_pending': {
        // 모든 pending 작업 취소
        const { data: cancelledJobs, error } = await client
          .from('scheduled_jobs')
          .update({ 
            status: 'cancelled',
            updated_at: now.toISOString()
          })
          .eq('status', 'pending')
          .select();

        if (error) {
          console.error('❌ 모든 대기 작업 취소 실패:', error);
          return NextResponse.json({
            success: false,
            message: '모든 대기 작업 취소에 실패했습니다: ' + error.message
          }, { status: 500 });
        }

        const cancelledCount = cancelledJobs?.length || 0;
        
        return NextResponse.json({
          success: true,
          data: { cancelledCount },
          message: `${cancelledCount}개의 대기 중인 작업이 취소되었습니다.`
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: `지원하지 않는 액션입니다: ${action}`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ 스케줄러 API 오류:', error);
    return NextResponse.json({
      success: false,
      message: '스케줄러 작업 실패: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
} 