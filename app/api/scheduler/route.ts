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
      .select('id, status, scheduled_time, workflow_data, created_at, started_at')
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
    const runningJobs = [];

    jobs?.forEach(job => {
      statusCounts[job.status as keyof typeof statusCounts]++;
      
      // 🔥 스마트 시간 해석: UTC/KST 형식 자동 감지 (실행 API와 동일한 로직)
      let scheduledTimeKST: Date;
      
      try {
        const storedTimeString = job.scheduled_time;
        
        // 타임존이 포함된 ISO 문자열인지 확인 (+09:00, Z 등)
        if (storedTimeString.includes('+09:00') || storedTimeString.includes('+0900')) {
          // 한국 타임존이 포함된 경우: 한국 시간 값으로 Date 객체 생성
          // "2025-06-30T10:35:00+09:00" → 한국 시간 10:35 값을 가진 Date 객체
          const timeMatch = storedTimeString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
          if (timeMatch) {
            const [, year, month, day, hour, minute, second] = timeMatch;
            scheduledTimeKST = new Date(
              parseInt(year),
              parseInt(month) - 1, // JavaScript month는 0-based
              parseInt(day),
              parseInt(hour),
              parseInt(minute),
              parseInt(second)
            );
          } else {
            // 파싱 실패 시 기본값
            scheduledTimeKST = new Date(storedTimeString);
          }
          console.log(`⚡ 타임존 포함 - 한국시간값으로 변환: ${storedTimeString} → ${scheduledTimeKST.toISOString()}`);
        } else if (storedTimeString.includes('Z')) {
          // UTC 타임존이 포함된 경우: UTC로 해석하고 한국시간으로 변환
          const storedTime = new Date(storedTimeString);
          scheduledTimeKST = utcToKoreaTime(storedTime);
          console.log(`⚡ UTC 타임존 - UTC→KST 변환: ${storedTimeString} → ${scheduledTimeKST.toISOString()}`);
        } else {
          // 타임존이 없는 경우: 기존 스마트 감지 로직 적용
          const storedTime = new Date(storedTimeString);
          
          // 생성 시간이 최근(24시간 이내)이면 새 형식(KST 저장)으로 간주
          const createdAt = new Date(job.created_at || job.scheduled_time);
          const isRecentData = (now.getTime() - createdAt.getTime()) < (24 * 60 * 60 * 1000);
          
          if (isRecentData) {
            // 새 데이터: 한국시간으로 저장됨
            scheduledTimeKST = storedTime;
            console.log(`⚡ 최근 데이터 - KST 직접 해석: ${storedTimeString} → ${scheduledTimeKST.toISOString()}`);
          } else {
            // 기존 데이터: UTC/KST 자동 감지
            const utcInterpretation = utcToKoreaTime(storedTime);
            const directInterpretation = storedTime;
            
            const utcDiffHours = Math.abs(now.getTime() - utcInterpretation.getTime()) / (1000 * 60 * 60);
            const directDiffHours = Math.abs(now.getTime() - directInterpretation.getTime()) / (1000 * 60 * 60);
            
            if (utcDiffHours < directDiffHours && utcDiffHours < 24) {
              scheduledTimeKST = utcInterpretation;
              console.log(`⚡ 기존 데이터 - UTC 해석: ${storedTimeString} → ${scheduledTimeKST.toISOString()}`);
            } else {
              scheduledTimeKST = directInterpretation;
              console.log(`⚡ 기존 데이터 - KST 해석: ${storedTimeString} → ${scheduledTimeKST.toISOString()}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ 시간 파싱 실패: ${job.scheduled_time}`, error);
        scheduledTimeKST = new Date(job.scheduled_time);
      }
      
      if (job.status === 'pending') {
        const timeUntil = scheduledTimeKST.getTime() - now.getTime();
        const minutesUntil = Math.round(timeUntil / (1000 * 60));
        
        if (minutesUntil <= 30 && minutesUntil >= 0) {
          upcomingJobs.push({
            ...job,
            timeUntil: `${minutesUntil}분 후`,
            scheduledTime: scheduledTimeKST.toISOString()
          });
        }
      } else if (job.status === 'running') {
        runningJobs.push(job);
      } else if (job.status === 'completed' && 'completed_at' in job && job.completed_at) {
        const completedTime = new Date(job.completed_at as string);
        const timeSince = now.getTime() - completedTime.getTime();
        const hoursSince = timeSince / (1000 * 60 * 60);
        
        if (hoursSince <= 1) {
          recentJobs.push({
            ...job,
            completedTime: completedTime.toISOString()
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        currentTime: now.toISOString(),
        statusCounts,
        upcomingJobs: upcomingJobs.slice(0, 10), // 최대 10개
        recentJobs: recentJobs.slice(-10), // 최근 10개
        runningJobs: runningJobs,
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
          .like('workflow_data->>name', '%테스트%') // JSONB 필드 올바른 접근 방법
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

      case 'reset_stuck_jobs': {
        // 멈춰있는 running 작업들 정리 (1시간 이상 running 상태)
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        
        const { data: resetJobs, error } = await client
          .from('scheduled_jobs')
          .update({ 
            status: 'failed',
            error_message: '시스템 정리: 1시간 이상 실행 상태로 멈춘 작업',
            updated_at: now.toISOString()
          })
          .eq('status', 'running')
          .lt('started_at', oneHourAgo)
          .select();

        if (error) {
          console.error('❌ 멈춰있는 작업 정리 실패:', error);
          return NextResponse.json({
            success: false,
            message: '멈춰있는 작업 정리에 실패했습니다: ' + error.message
          }, { status: 500 });
        }

        const resetCount = resetJobs?.length || 0;
        
        return NextResponse.json({
          success: true,
          data: { resetCount },
          message: `${resetCount}개의 멈춰있는 작업이 정리되었습니다.`
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