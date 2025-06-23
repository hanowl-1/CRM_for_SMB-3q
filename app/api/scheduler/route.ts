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

      case 'cleanup_test_jobs': {
        // 테스트 작업들 정리 (이름에 "테스트"가 포함된 작업들)
        try {
          const { getSupabase } = await import('@/lib/database/supabase-client');
          const client = getSupabase();
          
          const { data, error } = await client
            .from('scheduled_jobs')
            .update({ status: 'cancelled' })
            .like('workflow_data->name', '%테스트%')
            .in('status', ['pending', 'running'])
            .select();

          if (error) {
            throw error;
          }

          const cleanedCount = data?.length || 0;
          
          return NextResponse.json({
            success: true,
            data: { cleanedCount },
            message: `${cleanedCount}개의 테스트 작업이 정리되었습니다.`
          });
        } catch (error) {
          console.error('❌ 테스트 작업 정리 실패:', error);
          return NextResponse.json({
            success: false,
            message: '테스트 작업 정리에 실패했습니다.'
          }, { status: 500 });
        }
      }

      case 'reset_and_reschedule': {
        // 모든 pending 작업 취소 후 활성 워크플로우들 재등록
        try {
          const { getSupabase } = await import('@/lib/database/supabase-client');
          const client = getSupabase();
          
          // 1. 기존 pending 작업들 취소
          const { data: cancelledJobs, error: cancelError } = await client
            .from('scheduled_jobs')
            .update({ status: 'cancelled' })
            .eq('status', 'pending')
            .select();

          if (cancelError) {
            throw cancelError;
          }

          const cancelledCount = cancelledJobs?.length || 0;

          // 2. 활성 워크플로우들 조회 및 재등록
          const { data: workflows, error: workflowError } = await client
            .from('workflows')
            .select('*')
            .eq('status', 'active');

          if (workflowError) {
            throw workflowError;
          }

          const scheduledJobs = [];
          let rescheduledCount = 0;

          for (const workflow of workflows || []) {
            const scheduleConfig = workflow.schedule_config;
            
            if (scheduleConfig && scheduleConfig.type && scheduleConfig.type !== 'immediate') {
              // 워크플로우를 스케줄러 형식으로 변환
              const schedulerWorkflow = {
                id: workflow.id,
                name: workflow.name,
                description: workflow.description || '',
                status: workflow.status,
                trigger: workflow.trigger_type || 'schedule',
                steps: workflow.steps || [],
                createdAt: workflow.created_at,
                updatedAt: workflow.updated_at || workflow.created_at,
                stats: {
                  totalRuns: 0,
                  successRate: 0
                },
                scheduleSettings: {
                  type: scheduleConfig.type,
                  timezone: scheduleConfig.timezone || 'Asia/Seoul',
                  recurringPattern: scheduleConfig.recurringPattern,
                  scheduledTime: scheduleConfig.scheduledTime,
                  delay: scheduleConfig.delay
                }
              };

              const jobId = await persistentSchedulerService.scheduleWorkflow(schedulerWorkflow);
              
              if (jobId) {
                scheduledJobs.push({
                  workflowName: workflow.name,
                  jobId
                });
                rescheduledCount++;
              }
            }
          }
          
          return NextResponse.json({
            success: true,
            data: { 
              cancelledCount,
              rescheduledCount,
              scheduledJobs
            },
            message: `${cancelledCount}개 작업 취소, ${rescheduledCount}개 워크플로우 재등록 완료`
          });
        } catch (error) {
          console.error('❌ 스케줄러 재설정 실패:', error);
          return NextResponse.json({
            success: false,
            message: '스케줄러 재설정에 실패했습니다.',
            error: error instanceof Error ? error.message : String(error)
          }, { status: 500 });
        }
      }

      case 'update_workflow_schedule': {
        // 워크플로우 스케줄 업데이트
        const { workflowId, scheduleConfig } = data;
        
        if (!workflowId || !scheduleConfig) {
          return NextResponse.json({
            success: false,
            message: 'workflowId와 scheduleConfig가 필요합니다.'
          }, { status: 400 });
        }

        try {
          const { getSupabase } = await import('@/lib/database/supabase-client');
          const client = getSupabase();
          
          // 1. 워크플로우 스케줄 설정 업데이트
          const { error: updateError } = await client
            .from('workflows')
            .update({ schedule_config: scheduleConfig })
            .eq('id', workflowId);

          if (updateError) {
            throw updateError;
          }

          // 2. 기존 pending 작업들 취소
          const { error: cancelError } = await client
            .from('scheduled_jobs')
            .update({ status: 'cancelled' })
            .eq('workflow_id', workflowId)
            .eq('status', 'pending');

          if (cancelError) {
            console.warn('기존 작업 취소 실패:', cancelError);
          }

          // 3. 새로운 스케줄로 재등록
          const { data: workflow, error: workflowError } = await client
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .single();

          if (workflowError || !workflow) {
            throw workflowError || new Error('워크플로우를 찾을 수 없습니다.');
          }

          // 워크플로우를 스케줄러 형식으로 변환
          const schedulerWorkflow = {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description || '',
            status: workflow.status,
            trigger: workflow.trigger_type || 'schedule',
            steps: workflow.steps || [],
            createdAt: workflow.created_at,
            updatedAt: workflow.updated_at || workflow.created_at,
            stats: {
              totalRuns: 0,
              successRate: 0
            },
            scheduleSettings: {
              type: scheduleConfig.type,
              timezone: scheduleConfig.timezone || 'Asia/Seoul',
              recurringPattern: scheduleConfig.recurringPattern,
              scheduledTime: scheduleConfig.scheduledTime,
              delay: scheduleConfig.delay
            }
          };

          const jobId = await persistentSchedulerService.scheduleWorkflow(schedulerWorkflow);
          
          return NextResponse.json({
            success: true,
            data: { 
              workflowId,
              jobId,
              scheduleConfig,
              nextRun: schedulerWorkflow.scheduleSettings.recurringPattern?.time
            },
            message: `워크플로우 스케줄이 ${scheduleConfig.recurringPattern?.time}로 업데이트되었습니다.`
          });
        } catch (error) {
          console.error('❌ 워크플로우 스케줄 업데이트 실패:', error);
          return NextResponse.json({
            success: false,
            message: '워크플로우 스케줄 업데이트에 실패했습니다.',
            error: error instanceof Error ? error.message : String(error)
          }, { status: 500 });
        }
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