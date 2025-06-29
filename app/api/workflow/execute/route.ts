import { NextRequest, NextResponse } from 'next/server';
import { Workflow } from '@/lib/types/workflow';
import { KakaoAlimtalkTemplateById } from '@/lib/data/kakao-templates';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { getSupabase, getSupabaseAdmin } from '@/lib/database/supabase-client';
import { 
  getKoreaTime, 
  koreaTimeToUTCString, 
  formatKoreaTime,
  debugTimeInfo,
  calculateNextKoreaScheduleTime, 
  koreaTimeToUTC
} from '@/lib/utils/timezone';
import { executeQuery } from '@/lib/database/mysql-connection.js';

const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const COOLSMS_SENDER = process.env.COOLSMS_SENDER;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;
const SMS_SENDER_NUMBER = process.env.SMS_SENDER_NUMBER;

// MySQL 설정
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'test',
  timezone: '+09:00'
};

interface ExecuteRequest {
  workflow?: Workflow;
  workflowId?: string;
  scheduledExecution?: boolean;
  jobId?: string;
  scheduledJobId?: string;
  enableRealSending?: boolean;
}

/**
 * 🎯 워크플로우 실행 API
 * 
 * ⚠️ 중요: 이 API의 개인화 로직은 미리보기 API(/api/workflow/preview)와 동일합니다.
 * 
 * 📋 공통 개인화 로직 (Feature_Workflow_Builder.md 4.1.1):
 * - individual_variable_mappings 테이블에서 저장된 변수 매핑 조회
 * - MySQL API를 통한 변수 쿼리 실행 및 전체 데이터 캐시
 * - AA열(변수 쿼리의 매칭 컬럼) ↔ BB열(대상자 쿼리의 매칭 컬럼) 범용적 매칭
 * - 매칭 성공 시 AB열(변수 쿼리의 출력 컬럼) 값을 최종 개인화 값으로 사용
 * - 매칭 실패 시 기본값 사용 (실행 시에는 샘플값 대신 '--' 사용)
 * 
 * 🔄 로직 동기화: 개인화 로직 수정 시 미리보기와 실행 API 모두 동일하게 수정 필요
 * 
 * 🚀 실행 전용 기능:
 * - 실제 알림톡 메시지 발송 (enableRealSending 파라미터)
 * - 스케줄 잡 상태 업데이트 (scheduled_jobs 테이블)
 * - 메시지 발송 로그 기록 (message_logs 테이블)
 */

export async function POST(request: NextRequest) {
  // 🔥 currentJobId를 최상위 스코프에서 선언하여 모든 catch 블록에서 접근 가능
  let currentJobId: string | undefined;
  
  try {
    // 🔥 Vercel Protection 우회를 위한 응답 헤더 설정
    const headers = new Headers();
    headers.set('x-vercel-bypass-protection', 'true');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // 🔥 스케줄러 내부 호출인지 확인 (Vercel 인증 우회)
    const isSchedulerInternal = request.headers.get('x-scheduler-internal') === 'true';
    const bypassSecret = request.headers.get('x-vercel-protection-bypass');
    
    if (isSchedulerInternal) {
      console.log('📋 스케줄러 내부 호출 감지됨');
      
      // Vercel Protection Bypass 검증
      if (bypassSecret && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
        if (bypassSecret === process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          console.log('✅ Vercel 인증 우회 성공');
        } else {
          console.warn('⚠️ Vercel 인증 우회 secret 불일치');
        }
      } else {
        console.warn('⚠️ Vercel 인증 우회 정보 누락');
        console.log('Environment VERCEL_AUTOMATION_BYPASS_SECRET:', process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? '설정됨' : '설정되지 않음');
        console.log('Bypass secret from header:', bypassSecret ? '전달됨' : '전달되지 않음');
      }
    }
    
    const body: ExecuteRequest = await request.json();
    let { workflow, workflowId, scheduledExecution = false, jobId, scheduledJobId, enableRealSending = false } = body;

    // 🔥 스케줄러에서 전달한 scheduledJobId를 jobId로 매핑
    if (scheduledJobId && !jobId) {
      jobId = scheduledJobId;
      console.log(`📋 scheduledJobId를 jobId로 매핑: ${jobId}`);
    }

    // 🔥 workflow 객체가 없으면 workflowId로 조회
    if (!workflow && workflowId) {
      console.log(`📋 workflowId로 워크플로우 정보 조회 중: ${workflowId}`);
      
      try {
        const { data: workflowData, error: workflowError } = await getSupabase()
          .from('workflows')
          .select('*')
          .eq('id', workflowId)
          .single();
        
        console.log('📋 워크플로우 조회 결과:', { 
          hasData: !!workflowData, 
          hasError: !!workflowError,
          errorMessage: workflowError?.message 
        });
        
        if (workflowError || !workflowData) {
          console.error('워크플로우 조회 실패:', workflowError);
          return NextResponse.json({
            success: false,
            message: `워크플로우 조회 실패: ${workflowError?.message || '워크플로우를 찾을 수 없음'}`
          }, { status: 404 });
        }
        
        console.log('📋 조회된 워크플로우 데이터:', {
          id: workflowData.id,
          name: workflowData.name,
          hasTargetConfig: !!workflowData.target_config,
          hasMessageConfig: !!workflowData.message_config
        });
        
        // 🔥 Supabase 워크플로우 데이터를 표준 Workflow 객체로 변환
        workflow = {
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
          variables: workflowData.variables
        } as Workflow & {
          target_config?: any;
          message_config?: any;
          variables?: any;
        };
        
        console.log('✅ 워크플로우 정보 조회 완료:', {
          id: workflow.id,
          name: workflow.name,
          targetGroupsLength: workflow.targetGroups?.length,
          stepsLength: workflow.steps?.length
        });
      } catch (dbError) {
        console.error('워크플로우 조회 중 오류:', dbError);
        return NextResponse.json({
          success: false,
          message: `워크플로우 조회 중 오류: ${dbError instanceof Error ? dbError.message : '알 수 없는 오류'}`
        }, { status: 500 });
      }
    }
    
    // 🔥 workflow 객체 검증
    if (!workflow) {
      console.error('워크플로우 객체가 없습니다:', { workflow, workflowId });
      return NextResponse.json({
        success: false,
        message: 'workflow 객체 또는 workflowId가 필요합니다.'
      }, { status: 400 });
    }

    console.log(`🚀 워크플로우 실행 시작: ${workflow.name} (${scheduledExecution ? '예약 실행' : '수동 실행'})`);

    // 🔥 추가 검증: workflow.name이 정의되어 있는지 확인
    if (!workflow.name) {
      console.error('워크플로우 이름이 정의되지 않음:', workflow);
      return NextResponse.json({
        success: false,
        message: '워크플로우 이름이 정의되지 않았습니다.'
      }, { status: 400 });
    }

    const results = [];
    let totalSuccessCount = 0;
    let totalFailedCount = 0;
    const allMessageLogs = []; // 메시지 로그 저장용 배열 추가

    // 워크플로우 실행 기록 생성
    // 🔥 UUID 생성 안전성 강화: crypto.randomUUID() 실패 시 fallback 제공
    let runId: string;
    try {
      runId = crypto.randomUUID();
      console.log(`🆔 워크플로우 실행 ID 생성: ${runId} (UUID 형식)`);
    } catch (uuidError) {
      // UUID 생성 실패 시 fallback (매우 드문 경우)
      runId = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      console.warn(`⚠️ UUID 생성 실패, fallback ID 사용: ${runId}`, uuidError);
    }
    
    /**
     * 🕐 시간대 처리 원칙:
     * - 저장: UTC로 DB 저장 (서버 환경 독립적)
     * - 표시: 사용자에게는 KST로 표시
     * - 연산: 내부 처리는 한국 시간 기준
     */
    const startTime = getKoreaTime(); // 🔥 시간대 처리: 한국 시간 기준으로 시작 시간 기록
    let endTime = getKoreaTime(); // 🔥 endTime을 상위 스코프에서 선언

    // 🔥 수동 실행도 스케줄 잡으로 기록하여 통합 모니터링
    if (!scheduledExecution) {
      console.log('📝 수동 실행을 스케줄 잡으로 기록 중...');
      try {
        const { data: newJob, error: insertError } = await getSupabase()
          .from('scheduled_jobs')
          .insert({
            workflow_id: workflow.id,
            workflow_data: {
              id: workflow.id,
              name: workflow.name,
              description: workflow.description,
              message_config: workflow.message_config || (workflow as any).message_config,
              target_config: workflow.target_config || (workflow as any).target_config,
              schedule_config: { type: 'immediate' }
            },
            scheduled_time: koreaTimeToUTCString(startTime), // 즉시 실행이므로 현재 시간
            status: 'running',
            retry_count: 0,
            max_retries: 1, // 수동 실행은 재시도 안 함
            created_at: koreaTimeToUTCString(startTime),
            executed_at: koreaTimeToUTCString(startTime) // 즉시 실행 시작
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ 수동 실행 스케줄 잡 생성 실패:', insertError);
        } else {
          currentJobId = newJob.id;
          console.log(`✅ 수동 실행 스케줄 잡 생성 완료: ${currentJobId}`);
        }
      } catch (scheduleError) {
        console.error('⚠️ 수동 실행 스케줄 잡 생성 중 오류:', scheduleError);
        // 스케줄 잡 생성 실패는 워크플로우 실행에 영향을 주지 않음
      }
    }

    try {
      // 🔥 3단계 워크플로우 구조에 맞춘 데이터 추출
      const workflowWithSupabaseProps = workflow as Workflow & {
        target_config?: any;
        message_config?: any;
        mapping_config?: any;
      };
      
      console.log('📋 워크플로우 실행 시작:', {
        id: workflow.id,
        name: workflow.name,
        targetGroupsCount: workflow.targetGroups?.length || 0,
        stepsCount: workflow.steps?.length || 0,
        hasTargetConfig: !!workflowWithSupabaseProps.target_config,
        hasMessageConfig: !!workflowWithSupabaseProps.message_config,
        hasMappingConfig: !!workflowWithSupabaseProps.mapping_config
      });
      
      // 🔥 1단계: 대상 그룹 정보 추출 (target_config 우선)
      let targetGroups = [];
      if (workflowWithSupabaseProps.target_config?.targetGroups) {
        targetGroups = workflowWithSupabaseProps.target_config.targetGroups;
        console.log('📋 target_config에서 타겟 그룹 추출:', targetGroups.length, '개');
      } else if (workflow.targetGroups) {
        targetGroups = workflow.targetGroups;
        console.log('📋 기존 targetGroups에서 타겟 그룹 추출:', targetGroups.length, '개');
      }
      
      // 🔥 2단계: 메시지 스텝 정보 추출 (message_config 우선)
      let messageSteps = [];
      if (workflowWithSupabaseProps.message_config?.steps) {
        messageSteps = workflowWithSupabaseProps.message_config.steps;
        console.log('📋 message_config에서 메시지 스텝 추출:', messageSteps.length, '개');
      } else if (workflow.steps) {
        messageSteps = workflow.steps;
        console.log('📋 기존 steps에서 메시지 스텝 추출:', messageSteps.length, '개');
      }
      
      // 🔥 3단계: 매핑 설정 정보 추출 (mapping_config 우선)
      let targetTemplateMappings = [];
      if (workflowWithSupabaseProps.mapping_config?.targetTemplateMappings) {
        targetTemplateMappings = workflowWithSupabaseProps.mapping_config.targetTemplateMappings;
        console.log('📋 mapping_config에서 매핑 설정 추출:', targetTemplateMappings.length, '개');
      } else if (workflowWithSupabaseProps.target_config?.targetTemplateMappings) {
        targetTemplateMappings = workflowWithSupabaseProps.target_config.targetTemplateMappings;
        console.log('📋 target_config에서 매핑 설정 추출 (하위 호환):', targetTemplateMappings.length, '개');
      } else if (workflow.targetTemplateMappings) {
        targetTemplateMappings = workflow.targetTemplateMappings;
        console.log('📋 기존 targetTemplateMappings에서 매핑 설정 추출:', targetTemplateMappings.length, '개');
      }
      
      // 🔥 데이터 검증
      if (targetGroups.length === 0) {
        throw new Error('대상 그룹이 설정되지 않았습니다. target_config.targetGroups를 확인해주세요.');
      }
      
      if (messageSteps.length === 0) {
        throw new Error('메시지 스텝이 설정되지 않았습니다. message_config.steps를 확인해주세요.');
      }

      // 각 스텝(템플릿) 실행
      for (let i = 0; i < messageSteps.length; i++) {
        const step = messageSteps[i];
        
        if (step.action.type !== 'send_alimtalk') {
          console.log(`⏭️ 지원하지 않는 액션 타입: ${step.action.type}`);
          continue;
        }

        console.log(`📤 스텝 ${i + 1} 실행: ${step.name}`);

        // 대상 그룹별로 메시지 발송
        for (const targetGroup of targetGroups) {
          const stepResult = await executeStep(step, targetGroup, workflow, enableRealSending, targetTemplateMappings);
          results.push({
            step: i + 1,
            stepName: step.name,
            targetGroup: targetGroup.name,
            ...stepResult
          });

          // 메시지 로그 수집
          if (stepResult.messageLogs) {
            allMessageLogs.push(...stepResult.messageLogs);
          }

          if (stepResult.status === 'success') {
            totalSuccessCount += stepResult.successCount || 1;
          } else {
            totalFailedCount += stepResult.failedCount || 1;
          }
        }

        // 스텝 간 지연 시간 적용
        if (step.action.delay && step.action.delay > 0) {
          console.log(`⏱️ ${step.action.delay}분 대기 중...`);
          await new Promise(resolve => setTimeout(resolve, step.action.delay! * 60000));
        }
      }

      // 🔥 시간대 처리: 한국 시간 기준으로 종료 시간 기록
      endTime = getKoreaTime();
      const executionTimeMs = endTime.getTime() - startTime.getTime();

      // 🔥 워크플로우 실행 기록 저장 (실패해도 스케줄 작업 상태 업데이트에 영향 없음)
      try {
        console.log(`💾 워크플로우 실행 기록 저장 시작: ${runId}`);
        await supabaseWorkflowService.createWorkflowRun({
          id: runId,
          workflowId: workflow.id,
          status: totalFailedCount > 0 ? 'partial_success' : 'success',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: totalSuccessCount + totalFailedCount,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          totalCost: 0, // 비용 계산 로직 추가 필요
          executionTimeMs,
          // 🔥 시간대 처리: 한국 시간을 UTC로 변환하여 DB 저장
          startedAt: koreaTimeToUTCString(startTime),
          completedAt: koreaTimeToUTCString(endTime),
          logs: results
        });
        console.log(`✅ 워크플로우 실행 기록 저장 성공: ${runId}`);
      } catch (dbError) {
        console.error('❌ 워크플로우 실행 기록 저장 실패:', dbError);
        console.log('⚠️ 실행 기록 저장 실패했지만 워크플로우는 성공적으로 완료되었습니다.');
        // 🔥 실행 기록 저장 실패는 워크플로우 성공에 영향을 주지 않음
      }

      // 🔥 메시지 로그 저장 (실패해도 스케줄 작업 상태 업데이트에 영향 없음)
      if (allMessageLogs.length > 0) {
        try {
          console.log(`💾 메시지 로그 저장 시작: ${allMessageLogs.length}개`);
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' 
            ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-domain.vercel.app')
            : 'http://localhost:3000')}/api/supabase/message-logs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'bulk_create',
              logs: allMessageLogs
            })
          });

          if (!response.ok) {
            console.error('❌ 메시지 로그 저장 실패:', await response.text());
          } else {
            console.log(`✅ ${allMessageLogs.length}개 메시지 로그 저장 완료`);
          }
        } catch (logError) {
          console.error('❌ 메시지 로그 저장 오류:', logError);
          console.log('⚠️ 메시지 로그 저장 실패했지만 워크플로우는 성공적으로 완료되었습니다.');
          // 🔥 메시지 로그 저장 실패는 워크플로우 성공에 영향을 주지 않음
        }
      }

      // 🔥 워크플로우 실행 완료 후 처리 (return 전에 실행되어야 함)
      try {
        // 1. 수동 실행으로 생성된 스케줄 잡 완료 처리
        if (currentJobId) {
          console.log(`🔄 수동 실행 스케줄 잡 완료 처리: ${currentJobId}`);
          try {
            await getSupabase()
              .from('scheduled_jobs')
              .update({ 
                status: 'completed',
                completed_at: koreaTimeToUTCString(endTime),
                updated_at: koreaTimeToUTCString(endTime)
              })
              .eq('id', currentJobId);
            console.log(`✅ 수동 실행 스케줄 잡 완료 처리 성공: ${currentJobId}`);
          } catch (updateError) {
            console.error(`❌ 수동 실행 스케줄 잡 완료 처리 실패: ${currentJobId}`, updateError);
          }
        }

        // 2. 기존 스케줄 실행 잡 완료 처리 (스케줄 실행인 경우)
        if (scheduledExecution && jobId) {
          console.log(`🔄 스케줄 잡 완료 처리 시작: ${jobId}`);
          console.log(`📋 scheduledExecution: ${scheduledExecution}, jobId: ${jobId}`);
          
          const { data: updateResult, error: updateError } = await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'completed',
              completed_at: koreaTimeToUTCString(endTime),
              updated_at: koreaTimeToUTCString(endTime)
            })
            .eq('id', jobId)
            .select(); // 🔥 업데이트 결과 확인을 위해 select 추가
          
          if (updateError) {
            console.error(`❌ 스케줄 잡 완료 처리 실패: ${jobId}`, updateError);
          } else if (updateResult && updateResult.length > 0) {
            console.log(`✅ 스케줄 잡 완료 처리 성공: ${jobId}`, updateResult[0]);
          } else {
            console.warn(`⚠️ 스케줄 잡을 찾을 수 없음: ${jobId}`);
          }
        } else {
          console.log(`📋 스케줄 잡 완료 처리 건너뜀 - scheduledExecution: ${scheduledExecution}, jobId: ${jobId}`);
        }
        
        // 3. 반복 스케줄인 경우 다음 스케줄 잡 생성
        const scheduleConfig = workflow.scheduleSettings || (workflow as any).schedule_config;
        
        if (scheduleConfig && scheduleConfig.type === 'recurring' && scheduleConfig.recurringPattern) {
          console.log('🔄 반복 스케줄 감지, 다음 스케줄 잡 생성 중...');
          
          try {
            // 스케줄 등록 API 호출
            const baseUrl = process.env.NODE_ENV === 'production' 
              ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL || 'https://v0-kakao-beryl.vercel.app')
              : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

            console.log('📡 다음 스케줄 등록 API 호출:', `${baseUrl}/api/scheduler/register`);
            
            const registerResponse = await fetch(`${baseUrl}/api/scheduler/register`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
                'x-vercel-set-bypass-cookie': 'true'
              }
            });

            if (registerResponse.ok) {
              const registerResult = await registerResponse.json();
              console.log('✅ 다음 스케줄 등록 성공:', registerResult.message);
            } else {
              const errorText = await registerResponse.text();
              console.warn('⚠️ 다음 스케줄 등록 실패:', errorText);
            }
          } catch (registerError) {
            console.warn('⚠️ 다음 스케줄 등록 중 오류:', registerError);
          }
        }
        
      } catch (postProcessError) {
        console.warn('⚠️ 워크플로우 실행 후 처리 중 오류:', postProcessError);
        // 후처리 실패는 전체 실행 성공에 영향을 주지 않음
      }

      // 🔥 모든 처리 완료 후 응답 반환
      return NextResponse.json({
        success: true,
        message: '워크플로우 실행이 완료되었습니다.',
        runId,
        results,
        summary: {
          totalSteps: messageSteps.length,
          totalTargetGroups: targetGroups.length,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          executionTimeMs
        },
        scheduledExecution,
        jobId
      }, {
        headers: {
          'x-vercel-bypass-protection': 'true',
          'x-vercel-set-bypass-cookie': 'true',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

    } catch (error) {
      // 🔥 실행 실패 시 스케줄 잡 상태 업데이트
      if (currentJobId) {
        try {
          console.log(`❌ 워크플로우 실행 실패, 스케줄 잡 상태 업데이트: ${currentJobId}`);
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: error instanceof Error ? error.message : '알 수 없는 오류',
              completed_at: koreaTimeToUTCString(getKoreaTime()),
              updated_at: koreaTimeToUTCString(getKoreaTime())
            })
            .eq('id', currentJobId);
          console.log(`✅ 스케줄 잡 실패 상태 업데이트 완료: ${currentJobId}`);
        } catch (updateError) {
          console.error('❌ 스케줄 잡 실패 상태 업데이트 실패:', updateError);
        }
      }

      // 실행 실패 기록
      try {
        await supabaseWorkflowService.createWorkflowRun({
          id: runId,
          workflowId: workflow.id,
          status: 'failed',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: 0,
          successCount: 0,
          failedCount: 0,
          totalCost: 0,
          executionTimeMs: Date.now() - startTime.getTime(),
          startedAt: startTime.toISOString(),
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          logs: results
        });
      } catch (dbError) {
        console.error('워크플로우 실행 실패 기록 저장 실패:', dbError);
      }

      throw error;
    }

  } catch (error) {
    console.error('워크플로우 실행 실패:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '워크플로우 실행에 실패했습니다.',
        error: error
      },
      { status: 500 }
    );
  }
}

// 개별 스텝 실행
async function executeStep(step: any, targetGroup: any, workflow: Workflow, enableRealSending: boolean, targetTemplateMappings: any) {
  try {
    const templateId = step.action.templateId;
    const templateCode = step.action.templateCode;
    
    // 템플릿 정보 조회
    const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
    if (!templateInfo) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
    }

    // 🔥 미리보기 API와 동일한 개인화 로직 사용 (Feature_Workflow_Builder.md 4.1.1 범용적 매칭 시스템)
    // individual_variable_mappings 테이블에서 저장된 매핑 정보 조회
    console.log('🔍 개인화 매핑 정보 조회 중...');
    let savedMappings: any[] = [];
    
    try {
      console.log('📋 Supabase 연결 시도 중...');
      const supabase = getSupabaseAdmin();
      console.log('📋 Supabase 클라이언트 생성 완료');
      
      const { data: mappings, error: mappingError } = await supabase
        .from('individual_variable_mappings')
        .select('*');
        
      console.log('📋 매핑 조회 결과:', {
        hasData: !!mappings,
        dataLength: mappings?.length || 0,
        hasError: !!mappingError,
        errorMessage: mappingError?.message,
        errorCode: mappingError?.code
      });
        
      if (mappingError) {
        console.error('❌ 개인화 매핑 조회 실패:', mappingError);
      } else {
        savedMappings = mappings || [];
        console.log(`📋 개인화 매핑 ${savedMappings.length}개 조회됨`);
        if (savedMappings.length > 0) {
          console.log('📋 첫 번째 매핑 샘플:', savedMappings[0]);
        }
      }
    } catch (mappingFetchError) {
      console.error('❌ 개인화 매핑 조회 중 오류:', mappingFetchError);
    }

    // 🔥 변수 쿼리 실행 및 캐싱 (미리보기 API와 동일한 로직)
    const variableDataCache = new Map<string, any[]>();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'production' 
      ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-domain.vercel.app')
      : 'http://localhost:3000');

    if (savedMappings.length > 0) {
      console.log('🔍 변수 쿼리 실행 시작...');
      
      for (const mapping of savedMappings) {
        if (mapping.source_type === 'query' && mapping.source_field && !variableDataCache.has(mapping.variable_name)) {
          try {
            console.log(`📊 변수 쿼리 실행: ${mapping.variable_name}`);
            
            const variableResponse = await fetch(`${baseUrl}/api/mysql/query`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
                'x-vercel-set-bypass-cookie': 'true'
              },
              body: JSON.stringify({ 
                query: mapping.source_field
              })
            });

            if (variableResponse.ok) {
              const variableResult = await variableResponse.json();
              if (variableResult.success && variableResult.data && variableResult.data.length > 0) {
                variableDataCache.set(mapping.variable_name, variableResult.data);
                console.log(`✅ 변수 쿼리 성공: ${mapping.variable_name} (${variableResult.data.length}개 행)`);
              } else {
                console.log(`❌ 변수 쿼리 결과 없음: ${mapping.variable_name}`);
              }
            } else {
              const errorText = await variableResponse.text();
              console.error(`❌ 변수 쿼리 API 호출 실패: ${mapping.variable_name} (${variableResponse.status})`);
            }
          } catch (queryError) {
            console.error(`❌ 변수 쿼리 실행 오류 (${mapping.variable_name}):`, queryError);
          }
        }
      }
    }

    console.log(`🔍 변수 캐시 상태: ${variableDataCache.size}개 변수, 총 ${Array.from(variableDataCache.values()).reduce((sum, arr) => sum + arr.length, 0)}개 행`);

    // 대상 그룹에서 실제 대상자 조회
    const targets = await getTargetsFromGroup(targetGroup);
    
    let successCount = 0;
    let failedCount = 0;
    const messageResults = [];
    const messageLogs = []; // 메시지 로그 배열 추가

    for (const target of targets) {
      try {
        // 🔥 미리보기 API와 동일한 개인화 로직 적용
        // 기본 변수 설정
        const personalizedVariables: Record<string, string> = {
          'name': target.name || '이름 없음',
          'id': String(target.id || 'unknown'),
          'company_name': target.company || target.name || '회사명 없음',
        };

        // 🔥 Feature_Workflow_Builder.md 4.1.1 범용적 매칭 시스템
        // AA열(변수 쿼리의 매칭 컬럼) ↔ BB열(대상자 쿼리의 매칭 컬럼) 매칭
        if (savedMappings.length > 0) {
          const contact = target.rawData || target;
          
          for (const mapping of savedMappings) {
            if (mapping.source_type === 'query' && variableDataCache.has(mapping.variable_name)) {
              const variableData = variableDataCache.get(mapping.variable_name) || [];
              
              // BB열: 대상자 쿼리의 매칭 컬럼 (기본값: id)
              // keyColumn에서 테이블 별칭 제거 (예: "a.id" → "id")
              const rawKeyColumn = mapping.key_column || 'id';
              const targetMatchingColumn = rawKeyColumn.includes('.') ? rawKeyColumn.split('.').pop() : rawKeyColumn;
              const targetMatchingValue = contact[targetMatchingColumn];
              
              console.log(`🔍 매칭 시도: ${mapping.variable_name}`, {
                rawKeyColumn: rawKeyColumn,
                targetColumn: targetMatchingColumn,
                targetValue: targetMatchingValue,
                variableDataCount: variableData.length,
                outputColumn: mapping.selected_column,
                contactKeys: Object.keys(contact)
              });
              
              // AA열(변수 쿼리의 매칭 컬럼) ↔ BB열(대상자 쿼리의 매칭 컬럼) 매칭
              const matchedRow = variableData.find(row => {
                // 변수 쿼리 결과에서 실제 사용 가능한 컬럼 확인
                const availableColumns = Object.keys(row);
                let variableMatchingValue;
                
                // 1) 설정된 keyColumn 사용 시도
                if (row[rawKeyColumn] !== undefined) {
                  variableMatchingValue = row[rawKeyColumn];
                }
                // 2) adId 컬럼 사용 시도 (리뷰 데이터의 경우)
                else if (row['adId'] !== undefined) {
                  variableMatchingValue = row['adId'];
                }
                // 3) id 컬럼 사용 시도
                else if (row['id'] !== undefined) {
                  variableMatchingValue = row['id'];
                }
                // 4) 첫 번째 컬럼 사용
                else {
                  variableMatchingValue = row[availableColumns[0]];
                }
                
                const isMatch = String(variableMatchingValue) === String(targetMatchingValue);
                if (isMatch) {
                  console.log(`✅ 매칭 발견: ${variableMatchingValue} === ${targetMatchingValue} (컬럼: ${availableColumns.join(', ')})`);
                }
                return isMatch;
              });
              
              if (matchedRow) {
                // AB열(변수 쿼리의 출력 컬럼) → 최종 개인화 값
                const personalizedValue = matchedRow[mapping.selected_column];
                // 🔥 변수명에서 브레이스 제거하여 저장 (#{total_reviews} → total_reviews)
                const cleanVariableName = mapping.variable_name.replace(/^#{|}$/g, '');
                personalizedVariables[cleanVariableName] = String(personalizedValue || mapping.default_value || '--');
                
                console.log(`🔗 매칭 성공: ${mapping.variable_name} = "${personalizedValue}" (${targetMatchingColumn}=${targetMatchingValue})`);
              } else {
                // 매칭 실패 시 기본값 사용
                const defaultValue = mapping.default_value || '--';
                const cleanVariableName = mapping.variable_name.replace(/^#{|}$/g, '');
                personalizedVariables[cleanVariableName] = defaultValue;
                console.log(`⚠️ 매칭 실패, 기본값 사용: ${mapping.variable_name} = "${defaultValue}" (대상값: ${targetMatchingValue})`);
              }
            }
          }
        }

        // 🔥 템플릿에서 모든 변수 패턴 찾기 및 기본값 설정
        let processedContent = templateInfo.content;
        const templateVariableMatches = processedContent.match(/#{([^}]+)}/g) || [];
              
        // 발견된 모든 변수에 대해 기본값 설정
        templateVariableMatches.forEach(fullVar => {
          const variableName = fullVar.replace(/^#{|}$/g, '');
          
          // 매칭된 실제 값이 없는 경우에만 기본값 사용
          if (personalizedVariables[variableName] === undefined) {
            // 워크플로우에서 설정한 기본값 또는 '--' 사용
            personalizedVariables[variableName] = '--';
            console.log(`🎲 기본값 사용: ${fullVar} = "--"`);
          }
        });

        // 🔥 변수 치환 (매칭된 실제 값 우선 사용)
        templateVariableMatches.forEach(fullVar => {
          const variableName = fullVar.replace(/^#{|}$/g, '');
          const replacementValue = personalizedVariables[variableName] || '--';
          processedContent = processedContent.replace(new RegExp(fullVar.replace(/[{}]/g, '\\$&'), 'g'), replacementValue);
        });

        console.log(`📤 대상자: ${target.name} (${target.phoneNumber})`);
        console.log(`📋 최종 개인화 변수:`, personalizedVariables);

        const result = await sendAlimtalk({
          templateId,
          templateContent: processedContent as any,
          phoneNumber: target.phoneNumber,
          variables: personalizedVariables,
          enableRealSending
        });

        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'success',
          messageId: result.messageId,
          variables: personalizedVariables
        });

        // 메시지 로그 생성
        messageLogs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          messageType: 'kakao',
          recipientPhone: target.phoneNumber,
          recipientEmail: target.email || null,
          recipientName: target.name || null,
          templateId: templateId,
          templateName: templateInfo.templateName || step.name,
          messageContent: processedContent, // 개인화된 콘텐츠 저장
          variables: personalizedVariables,
          status: enableRealSending ? 'sent' : 'pending',
          provider: 'coolsms',
          providerMessageId: result.messageId,
          costAmount: 15, // 카카오 알림톡 기본 비용
          // 🔥 시간대 처리: 발송 시간을 한국 시간 기준으로 기록 후 UTC 저장
          sentAt: enableRealSending ? koreaTimeToUTCString(getKoreaTime()) : null
        });

        successCount++;

      } catch (error) {
        messageResults.push({
          target: target.name || target.phoneNumber,
          status: 'failed',
          error: error instanceof Error ? error.message : '발송 실패'
        });

        // 실패한 메시지 로그도 생성
        messageLogs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          messageType: 'kakao',
          recipientPhone: target.phoneNumber,
          recipientEmail: target.email || null,
          recipientName: target.name || null,
          templateId: templateId,
          templateName: templateInfo.templateName || step.name,
          messageContent: templateInfo.content,
          variables: step.action.variables,
          status: 'failed',
          provider: 'coolsms',
          errorMessage: error instanceof Error ? error.message : '발송 실패',
          costAmount: 0
        });

        failedCount++;
      }
    }

    return {
      status: failedCount === 0 ? 'success' : 'partial_success',
      successCount,
      failedCount,
      totalTargets: targets.length,
      messageResults,
      messageLogs // 메시지 로그 반환
    };

  } catch (error) {
    return {
      status: 'failed',
      successCount: 0,
      failedCount: 1,
      totalTargets: 0,
      error: error instanceof Error ? error.message : '스텝 실행 실패'
    };
  }
}

// 대상 그룹에서 실제 대상자 목록 조회
async function getTargetsFromGroup(targetGroup: any) {
  try {
    // MySQL 동적 쿼리 실행하여 실제 대상자 조회
    if (targetGroup.type === 'dynamic' && targetGroup.dynamicQuery?.sql) {
      console.log(`🔍 대상자 조회 시작 - MySQL API 호출 사용`);
      console.log(`📋 쿼리: ${targetGroup.dynamicQuery.sql}`);
      
      try {
        // 🔥 미리보기 API와 동일한 방식: MySQL API 호출
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://v0-kakao-beryl.vercel.app')
          : 'http://localhost:3000';

        const response = await fetch(`${baseUrl}/api/mysql/query`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
            'x-vercel-set-bypass-cookie': 'true'
          },
          body: JSON.stringify({ 
            query: targetGroup.dynamicQuery.sql,
            limit: 10000 // 충분한 데이터 로드
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MySQL API 호출 실패: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`📋 MySQL API 응답:`, { success: result.success, dataLength: result.data?.length });

        if (!result.success || !result.data || result.data.length === 0) {
          console.warn(`⚠️ 대상자 조회 결과 없음`);
          return [];
        }

        const contacts = result.data;
        console.log(`✅ 대상자 조회 성공: ${contacts.length}명`);

        // MySQL 결과를 대상자 형식으로 변환
        return contacts.map((row: any, index: number) => {
          // 연락처 필드 찾기 (contacts, phone, phoneNumber 등)
          const phoneNumber = row.contacts || row.phone || row.phoneNumber || '01000000000';
          const name = row.name || row.company || row.title || `대상자${index + 1}`;
          const email = row.email || null;

          console.log(`👤 대상자 ${index + 1}: ${name} (${phoneNumber})`);

          return {
            id: row.id || index + 1,
            name: name,
            phoneNumber: phoneNumber,
            email: email,
            rawData: row // 원본 데이터 보관 (변수 치환용)
          };
        });
      } catch (apiError) {
        console.error(`❌ MySQL API 호출 실패:`, apiError);
        throw apiError;
      }
    }
  } catch (error) {
    console.error('❌ 대상자 조회 실패:', error);
    // 에러 발생 시 빈 배열 반환
    return [];
  }

  // fallback으로 테스트 데이터 사용
  console.log('⚠️ fallback 테스트 데이터 사용');
  return [
    {
      id: 1,
      name: '테스트 고객',
      phoneNumber: '01012345678',
      email: 'test@example.com',
      rawData: { id: 1, name: '테스트 고객' }
    }
  ];
}

// 알림톡 발송
async function sendAlimtalk({
  templateId,
  templateContent,
  phoneNumber,
  variables,
  enableRealSending
}: {
  templateId: string;
  templateContent: any;
  phoneNumber: string;
  variables: Record<string, string>;
  enableRealSending: boolean;
}) {
  if (!enableRealSending) {
    // 테스트 모드
    console.log('📱 테스트 모드 - 알림톡 발송 시뮬레이션');
    return {
      messageId: `test_${Date.now()}`,
      processedContent: templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match)
    };
  }

  // 실제 발송
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  const pfId = getPfIdForTemplate(templateId);
  
  // 🔥 시간대 처리: API 인증을 위한 현재 시간 (UTC 기준)
  const date = new Date().toISOString();
  const salt = Date.now().toString();
  const signature = generateSignature(COOLSMS_API_KEY!, COOLSMS_API_SECRET!, date, salt);

  // CoolSMS API에 맞는 변수 형식으로 변환: #{변수명} 형식
  const coolsmsVariables: Record<string, string> = {};
  Object.entries(variables).forEach(([key, value]) => {
    coolsmsVariables[`#{${key}}`] = value;
  });

  // 변수 치환된 메시지 내용 생성 (로깅용)
  const processedContent = templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match);

  const messageData = {
    to: phoneNumber,
    from: SMS_SENDER_NUMBER,
    type: 'ATA',
    kakaoOptions: {
      pfId: pfId,
      templateId: templateId,
      variables: coolsmsVariables // CoolSMS API에 맞는 형식으로 전달
    }
  };

  console.log(`📱 실제 알림톡 발송: ${phoneNumber} - 템플릿: ${templateId}`);
  console.log(`📋 메시지 내용 (미리보기): ${processedContent}`);
  console.log(`🔑 발신프로필: ${pfId}`);
  console.log(`🔧 CoolSMS 변수:`, coolsmsVariables);

  const response = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Authorization': `HMAC-SHA256 apiKey=${COOLSMS_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: messageData
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ CoolSMS API 오류: ${response.status} - ${errorText}`);
    throw new Error(`CoolSMS API 오류: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ 알림톡 발송 성공: ${result.groupId || result.messageId}`);
  
  return {
    messageId: result.groupId || result.messageId,
    processedContent: processedContent
  };
}

// CoolSMS HMAC-SHA256 서명 생성
function generateSignature(apiKey: string, apiSecret: string, date: string, salt: string): string {
  const data = `${date}${salt}`;
  return crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
}

// 발신프로필 선택
function getPfIdForTemplate(templateId: string): string {
  const templateInfo = KakaoAlimtalkTemplateById[templateId as keyof typeof KakaoAlimtalkTemplateById];
  
  if (templateInfo) {
    const channel = templateInfo.channel;
    
    if (channel === 'CEO') {
      return process.env.PFID_CEO || templateInfo.channelId || KAKAO_SENDER_KEY || '';
    } else if (channel === 'BLOGGER') {
      return process.env.PFID_BLOGGER || templateInfo.channelId || KAKAO_SENDER_KEY || '';
    }
  }
  
  return KAKAO_SENDER_KEY || '';
}