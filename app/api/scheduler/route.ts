import { NextRequest, NextResponse } from 'next/server';
// import schedulerService from '@/lib/services/scheduler-service';
import persistentSchedulerService from '@/lib/services/persistent-scheduler-service';
import { Workflow } from '@/lib/types/workflow';

// GET: 스케줄러 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        // 상태 조회 시 대기 중인 작업들을 즉시 확인하고 실행
        await persistentSchedulerService.checkAndExecutePendingJobs();
        
        const status = await persistentSchedulerService.getStatus();
        return NextResponse.json({
          success: true,
          data: status,
          message: '영구 스케줄러 상태를 조회했습니다.'
        });

      case 'jobs':
        // 영구 스케줄러에서는 DB에서 직접 조회
        const jobs = await persistentSchedulerService.getStatus();
        return NextResponse.json({
          success: true,
          data: jobs,
          message: '예약된 작업 목록을 조회했습니다.'
        });

      default:
        return NextResponse.json({
          success: false,
          message: '올바른 action을 지정해주세요. (status, jobs)'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('영구 스케줄러 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '영구 스케줄러 조회에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// POST: 워크플로우 예약 및 스케줄러 제어
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'schedule': {
        const { workflow } = data as { workflow: Workflow };
        
        if (!workflow) {
          return NextResponse.json({
            success: false,
            message: '워크플로우 데이터가 필요합니다.'
          }, { status: 400 });
        }

        const jobId = await persistentSchedulerService.scheduleWorkflow(workflow);
        
        return NextResponse.json({
          success: true,
          data: { jobId },
          message: `워크플로우 "${workflow.name}"가 영구 스케줄러에 예약되었습니다.`
        });
      }

      case 'cancel': {
        const { jobId } = data;
        
        if (!jobId) {
          return NextResponse.json({
            success: false,
            message: 'jobId가 필요합니다.'
          }, { status: 400 });
        }

        const cancelled = await persistentSchedulerService.cancelJob(jobId);
        
        if (cancelled) {
          return NextResponse.json({
            success: true,
            message: '작업이 취소되었습니다.'
          });
        } else {
          return NextResponse.json({
            success: false,
            message: '작업을 찾을 수 없거나 이미 실행되었습니다.'
          }, { status: 404 });
        }
      }

      case 'cancel_workflow': {
        const { workflowId } = data;
        
        if (!workflowId) {
          return NextResponse.json({
            success: false,
            message: 'workflowId가 필요합니다.'
          }, { status: 400 });
        }

        const cancelledCount = await persistentSchedulerService.cancelWorkflowJobs(workflowId);
        
        return NextResponse.json({
          success: true,
          data: { cancelledCount },
          message: `${cancelledCount}개의 작업이 취소되었습니다.`
        });
      }

      case 'start': {
        persistentSchedulerService.startScheduler();
        return NextResponse.json({
          success: true,
          message: '영구 스케줄러가 시작되었습니다.'
        });
      }

      case 'stop': {
        persistentSchedulerService.stopScheduler();
        return NextResponse.json({
          success: true,
          message: '영구 스케줄러가 중지되었습니다.'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          message: '올바른 action을 지정해주세요. (schedule, cancel, cancel_workflow, start, stop)'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('영구 스케줄러 작업 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '영구 스케줄러 작업에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
} 