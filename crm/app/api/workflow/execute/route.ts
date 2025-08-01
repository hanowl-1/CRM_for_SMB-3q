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
  webhook_data?: any;
  webhook_event?: string; // 웹훅 이벤트 타입
  webhookExecution?: boolean;
  scheduleConfig?: any; // 스케줄 설정 (manual 실행용)
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

/**
 * 워크플로우를 스케줄링합니다 (delay/scheduled/recurring 타입)
 */
async function scheduleWorkflowExecution(
  workflowData: any, 
  scheduleConfig: any, 
  enableRealSending: boolean
) {
  const supabase = getSupabase();
  
  try {
    console.log(`📅 워크플로우 스케줄링: ${workflowData.name}`, scheduleConfig);
    
    // 실행 시간 계산
    let scheduledTime: Date;
    
    switch (scheduleConfig.type) {
      case 'delay':
        const delayMinutes = scheduleConfig.delay || 0;
        scheduledTime = new Date();
        scheduledTime.setMinutes(scheduledTime.getMinutes() + delayMinutes);
        console.log(`⏰ 지연 실행: ${delayMinutes}분 후 (${scheduledTime.toISOString()})`);
        break;
        
      case 'scheduled':
        if (!scheduleConfig.scheduledTime) {
          throw new Error('예약 실행에는 scheduledTime이 필요합니다.');
        }
        scheduledTime = new Date(scheduleConfig.scheduledTime);
        console.log(`⏰ 예약 실행: ${scheduledTime.toISOString()}`);
        break;
        
      case 'recurring':
        if (!scheduleConfig.recurringPattern) {
          throw new Error('반복 실행에는 recurringPattern이 필요합니다.');
        }
        // 다음 실행 시간 계산
        const { calculateNextKoreaScheduleTime } = require('@/lib/utils/timezone');
        const { frequency, time, daysOfWeek } = scheduleConfig.recurringPattern;
        scheduledTime = calculateNextKoreaScheduleTime(time, frequency, daysOfWeek);
        console.log(`⏰ 반복 실행: ${scheduledTime.toISOString()}`);
        break;
        
      default:
        throw new Error(`지원되지 않는 스케줄 타입: ${scheduleConfig.type}`);
    }
    
    // 한국시간대 문자열로 변환
    const year = scheduledTime.getFullYear();
    const month = String(scheduledTime.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledTime.getDate()).padStart(2, '0');
    const hours = String(scheduledTime.getHours()).padStart(2, '0');
    const minutes = String(scheduledTime.getMinutes()).padStart(2, '0');
    const seconds = String(scheduledTime.getSeconds()).padStart(2, '0');
    const kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
    
    // scheduled_jobs에 등록
    const { data: scheduledJob, error: insertError } = await supabase
      .from('scheduled_jobs')
      .insert({
        workflow_id: workflowData.id,
        workflow_data: {
          ...workflowData,
          schedule_config: scheduleConfig,
          variables: {
            ...workflowData.variables,
            testSettings: {
              ...workflowData.variables?.testSettings,
              enableRealSending
            }
          }
        },
        scheduled_time: kstTimeString,
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        created_at: kstTimeString
      })
      .select()
      .single();
      
    if (insertError) {
      console.error('❌ 스케줄 작업 등록 실패:', insertError);
      throw new Error(`스케줄 작업 등록 실패: ${insertError.message}`);
    }
    
    console.log(`✅ 스케줄 작업 등록 완료: ${scheduledJob.id}`);
    
    return NextResponse.json({
      success: true,
      message: `워크플로우가 스케줄링되었습니다 (${scheduleConfig.type})`,
      scheduledJobId: scheduledJob.id,
      scheduledTime: kstTimeString,
      scheduleType: scheduleConfig.type
    });
    
  } catch (error) {
    console.error('❌ 워크플로우 스케줄링 실패:', error);
    return NextResponse.json({
      success: false,
      message: `워크플로우 스케줄링 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }, { status: 500 });
  }
}

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
    let { workflow, workflowId, scheduledExecution = false, jobId, scheduledJobId, enableRealSending = false, webhook_data, webhook_event, webhookExecution = false, scheduleConfig } = body;

    // 🔥 스케줄러에서 전달한 scheduledJobId를 jobId로 매핑
    if (scheduledJobId && !jobId) {
      jobId = scheduledJobId;
      console.log(`📋 scheduledJobId를 jobId로 매핑: ${jobId}`);
    }

    // 🔥 웹훅 데이터 처리 (직접 전달된 데이터 우선)
    let webhookTriggerData = null;
    if (webhook_data && webhook_event) {
      console.log(`🔔 웹훅 데이터 직접 전달됨:`, { event: webhook_event, data: webhook_data });
      webhookTriggerData = {
        trigger_type: 'webhook',
        webhook_event: webhook_event,
        event_data: webhook_data,
        source: 'direct_webhook'
      };
    } else if (jobId && scheduledExecution) {
      console.log(`📋 스케줄된 작업에서 웹훅 데이터 조회 중: ${jobId}`);
      
      try {
        const { data: jobData, error: jobError } = await getSupabase()
          .from('scheduled_jobs')
          .select('workflow_data')
          .eq('id', jobId)
          .single();
        
        if (jobError) {
          console.error('스케줄된 작업 조회 실패:', jobError);
        } else if (jobData?.workflow_data) {
          try {
            // 🔥 workflow_data가 JSON 문자열로 저장되어 있으므로 파싱 필요
            const workflowDataObj = typeof jobData.workflow_data === 'string' 
              ? JSON.parse(jobData.workflow_data) 
              : jobData.workflow_data;
            
            if (workflowDataObj?.webhook_trigger) {
              webhookTriggerData = workflowDataObj.webhook_trigger;
              console.log('🔔 웹훅 트리거 데이터 발견:', webhookTriggerData);
            }
          } catch (parseError) {
            console.error('workflow_data JSON 파싱 실패:', parseError);
          }
        } else {
          console.log('⚠️ workflow_data가 없습니다');
        }
      } catch (jobQueryError) {
        console.error('스케줄된 작업 조회 중 오류:', jobQueryError);
      }
    }

    console.log('🔍 webhookTriggerData 복원 결과:', {
      webhookTriggerDataExists: !!webhookTriggerData,
      scheduledExecution: scheduledExecution,
      jobId: jobId
    });
    
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
          variables: workflowData.variables,
          trigger_type: workflowData.trigger_type,
          webhook_trigger: webhookTriggerData // 🔥 웹훅 트리거 데이터 추가
        } as Workflow & {
          target_config?: any;
          message_config?: any;
          variables?: any;
          trigger_type?: string;
          webhook_trigger?: any;
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
        // 🔥 간단하게: 현재 시간을 한국시간대로 명시
        const year = startTime.getFullYear();
        const month = String(startTime.getMonth() + 1).padStart(2, '0');
        const day = String(startTime.getDate()).padStart(2, '0');
        const hours = String(startTime.getHours()).padStart(2, '0');
        const minutes = String(startTime.getMinutes()).padStart(2, '0');
        const seconds = String(startTime.getSeconds()).padStart(2, '0');
        const kstTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
        
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
            scheduled_time: kstTimeString, // 🔥 한국시간대를 명시한 문자열
            status: 'running',
            retry_count: 0,
            max_retries: 1, // 수동 실행은 재시도 안 함
            created_at: kstTimeString, // 🔥 한국시간대를 명시한 문자열
            executed_at: kstTimeString // 🔥 한국시간대를 명시한 문자열
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
        trigger_type?: string;
        webhook_trigger?: any;
      };
      
      // 웹훅 트리거인지 확인 (직접 웹훅 또는 웹훅 데이터가 있는 경우)
      const isWebhookTrigger = workflowWithSupabaseProps.trigger_type === 'webhook' || 
                              workflowWithSupabaseProps.webhook_trigger?.trigger_type === 'webhook' ||
                              !!webhookTriggerData;
      
      console.log('🔍 웹훅 트리거 확인:', {
        trigger_type: workflowWithSupabaseProps.trigger_type,
        hasWebhookTriggerData: !!webhookTriggerData,
        isWebhookTrigger: isWebhookTrigger
      });
      
      console.log('📋 워크플로우 실행 시작:', {
        id: workflow.id,
        name: workflow.name,
        triggerType: workflowWithSupabaseProps.trigger_type,
        isWebhookTrigger,
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
      
      // 🔥 데이터 검증 (웹훅 타입은 대상 그룹 검증 건너뛰기)
      console.log('🔍 대상 그룹 검증:', {
        isWebhookTrigger: isWebhookTrigger,
        targetGroupsLength: targetGroups.length,
        willSkipValidation: isWebhookTrigger
      });
      
      if (!isWebhookTrigger && targetGroups.length === 0) {
        console.error('❌ 대상 그룹 검증 실패 - 웹훅이 아닌데 targetGroups가 비어있음');
        throw new Error('대상 그룹이 설정되지 않았습니다. target_config.targetGroups를 확인해주세요.');
      }
      
      if (isWebhookTrigger) {
        console.log('✅ 웹훅 트리거이므로 대상 그룹 검증 건너뛰기');
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

        if (isWebhookTrigger) {
          // 🔥 웹훅 타입: 이벤트 데이터에서 직접 연락처 추출
          const webhookEventData = webhookTriggerData?.event_data || 
                                   workflowWithSupabaseProps.webhook_trigger?.event_data || 
                                   {};
          const webhookTargetGroup = {
            id: 'webhook_target',
            name: '웹훅 이벤트 대상',
            type: 'webhook' as const,
            estimatedCount: 1,
            webhookEventData // 웹훅 이벤트 데이터 저장
          };
          
          const stepResult = await executeStep(step, webhookTargetGroup, workflow, enableRealSending, targetTemplateMappings);
          results.push({
            step: i + 1,
            stepName: step.name,
            targetGroup: webhookTargetGroup.name,
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
        } else {
          // 🔥 일반 타입: 대상 그룹별로 메시지 발송
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
          status: totalFailedCount > 0 ? 'partial_success' : 'completed',
          triggerType: scheduledExecution ? 'scheduled' : 'manual',
          targetCount: totalSuccessCount + totalFailedCount,
          successCount: totalSuccessCount,
          failedCount: totalFailedCount,
          totalCost: 0, // 비용 계산 로직 추가 필요
          executionTimeMs,
          // 🔥 시간대 처리: 한국 시간을 UTC로 변환하여 DB 저장
          startedAt: startTime.toISOString(),
          completedAt: endTime.toISOString(),
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
      console.log(`🚨🚨🚨 워크플로우 실행 완료 후 처리 시작 - 이 로그가 보이면 후처리 로직이 실행됨 🚨🚨🚨`);
      try {
        console.log(`🔍 워크플로우 실행 완료 후 처리 시작`);
        console.log(`📋 파라미터 상태: scheduledExecution=${scheduledExecution}, jobId=${jobId}, currentJobId=${currentJobId}, webhookExecution=${webhookExecution}`);
        
        // 1. 수동 실행으로 생성된 스케줄 잡 완료 처리
        if (currentJobId) {
          console.log(`📝 수동 실행 스케줄 잡 완료 처리: ${currentJobId}`);
          try {
            // 🔥 간단하게: 종료 시간을 한국시간대로 명시
            const year = endTime.getFullYear();
            const month = String(endTime.getMonth() + 1).padStart(2, '0');
            const day = String(endTime.getDate()).padStart(2, '0');
            const hours = String(endTime.getHours()).padStart(2, '0');
            const minutes = String(endTime.getMinutes()).padStart(2, '0');
            const seconds = String(endTime.getSeconds()).padStart(2, '0');
            const kstEndTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
            
            // 🔥 반복 스케줄 처리: 스케줄 잡 완료 전에 다음 실행 시간 계산
            console.log(`🔄 반복 스케줄 처리 시작: ${jobId}`);
            let nextScheduleCreated = false;
            
            // 워크플로우 스케줄 설정 확인
            const scheduleConfig = workflow.schedule_config || workflow.scheduleSettings;
            console.log(`📋 스케줄 설정 확인:`, scheduleConfig);
            
            if (scheduleConfig && scheduleConfig.type === 'recurring' && scheduleConfig.recurringPattern) {
              console.log(`🔄 반복 스케줄 감지됨: ${workflow.name}`);
              
              // 🔥 워크플로우 상태 재확인: 실행 완료 시점에 워크플로우가 비활성화되었을 수 있음
              console.log(`🔍 워크플로우 상태 재확인: ${workflow.id}`);
              const { data: currentWorkflow, error: statusCheckError } = await getSupabase()
                .from('workflows')
                .select('status')
                .eq('id', workflow.id)
                .single();
                
              if (statusCheckError) {
                console.error(`❌ 워크플로우 상태 확인 실패: ${workflow.id}`, statusCheckError);
              } else if (currentWorkflow.status !== 'active') {
                console.log(`⏸️ 워크플로우가 비활성 상태로 변경되어 다음 스케줄 등록 건너뜀: ${workflow.name} (상태: ${currentWorkflow.status})`);
              } else {
                console.log(`✅ 워크플로우 활성 상태 확인됨, 다음 스케줄 등록 진행: ${workflow.name}`);
                
                try {
                  // 다음 실행 시간 계산
                  const { frequency, time, daysOfWeek } = scheduleConfig.recurringPattern;
                  console.log(`⏰ 반복 패턴: ${frequency}, 시간: ${time}`);
                  
                  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
                    console.log(`📅 지정된 요일: ${daysOfWeek.map((d: number) => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}`);
                  }
                  
                  if (time) {
                    // calculateNextKoreaScheduleTime 함수 import 필요
                    const { calculateNextKoreaScheduleTime } = require('@/lib/utils/timezone');
                    const nextScheduledTime = calculateNextKoreaScheduleTime(time, frequency, daysOfWeek);
                    
                    console.log(`📅 다음 실행 시간 계산 완료: ${nextScheduledTime.toISOString()}`);
                    
                    // 🔥 다음 실행 시간을 한국시간대 문자열로 변환
                    const nextYear = nextScheduledTime.getFullYear();
                    const nextMonth = String(nextScheduledTime.getMonth() + 1).padStart(2, '0');
                    const nextDay = String(nextScheduledTime.getDate()).padStart(2, '0');
                    const nextHours = String(nextScheduledTime.getHours()).padStart(2, '0');
                    const nextMinutes = String(nextScheduledTime.getMinutes()).padStart(2, '0');
                    const nextSeconds = String(nextScheduledTime.getSeconds()).padStart(2, '0');
                    const nextKstTimeString = `${nextYear}-${nextMonth}-${nextDay} ${nextHours}:${nextMinutes}:${nextSeconds}+09:00`;
                    
                    console.log(`🔄 다음 스케줄 등록 시작: ${nextKstTimeString}`);
                    
                    // 새로운 스케줄 작업 등록
                    const { data: newScheduleJob, error: scheduleError } = await getSupabase()
                      .from('scheduled_jobs')
                      .insert({
                        workflow_id: workflow.id,
                        workflow_data: {
                          ...workflow,
                          schedule_config: scheduleConfig // 스케줄 설정 유지
                        },
                        scheduled_time: nextKstTimeString,
                        status: 'pending',
                        retry_count: 0,
                        max_retries: 3,
                        created_at: kstEndTimeString,
                        updated_at: kstEndTimeString
                      })
                      .select()
                      .single();
                      
                    if (scheduleError) {
                      console.error(`❌ 다음 스케줄 등록 실패: ${workflow.name}`, scheduleError);
                    } else if (newScheduleJob) {
                      console.log(`✅ 다음 스케줄 등록 성공: ${workflow.name}`, {
                        newJobId: newScheduleJob.id,
                        nextScheduledTime: nextKstTimeString,
                        frequency: frequency
                      });
                      nextScheduleCreated = true;
                    }
                  } else {
                    console.warn(`⚠️ 반복 스케줄에 시간 정보가 없음: ${workflow.name}`);
                  }
                } catch (recurringError) {
                  console.error(`❌ 반복 스케줄 처리 중 오류 발생: ${workflow.name}`, recurringError);
                }
              }
            } else {
              console.log(`📋 일회성 스케줄 또는 반복 설정 없음: ${workflow.name}`);
            }
            
            // 🔥 현재 스케줄 잡 완료 처리 (반복 스케줄 등록 후)
            console.log(`🏁 현재 스케줄 잡 완료 처리: ${jobId}`);
            const { data: updateResult, error: updateError } = await getSupabase()
              .from('scheduled_jobs')
              .update({ 
                status: 'completed',
                
                updated_at: kstEndTimeString
              })
              .eq('id', jobId)
              .select();
              
            if (updateError) {
              console.error(`❌🚨 스케줄 잡 완료 처리 실패: ${jobId}`, updateError);
            } else if (updateResult && updateResult.length > 0) {
              console.log(`✅🚨 스케줄 잡 완료 처리 성공: ${jobId}`, updateResult[0]);
              
              // 반복 스케줄 등록 결과 로그
              if (nextScheduleCreated) {
                console.log(`🔄✅ 반복 스케줄 처리 완료: ${workflow.name} - 다음 실행 시간 등록됨`);
              } else {
                console.log(`📋 일회성 스케줄 완료: ${workflow.name}`);
              }
            } else {
              console.warn(`⚠️🚨 스케줄 잡을 찾을 수 없음: ${jobId}`);
            }
          } catch (updateError) {
            console.error(`❌ 수동 실행 스케줄 잡 완료 처리 예외: ${currentJobId}`, updateError);
          }
        } else {
          console.log(`📋 currentJobId가 없어서 수동 실행 스케줄 잡 처리 건너뜀`);
        }

        // 2. 기존 스케줄 실행 잡 완료 처리 (스케줄 실행인 경우)
        console.log(`🚨🚨🚨 스케줄 실행 잡 완료 처리 체크: scheduledExecution=${scheduledExecution}, jobId=${jobId} 🚨🚨🚨`);
        if (scheduledExecution && jobId) {
          console.log(`🚨🚨🚨 스케줄 잡 완료 처리 시작: ${jobId} - 이 로그가 보이면 스케줄 잡 업데이트가 시작됨 🚨🚨🚨`);
          console.log(`📋 scheduledExecution: ${scheduledExecution}, jobId: ${jobId}`);
          
          // 🔥 스케줄 잡 존재 여부 먼저 확인
          console.log(`🔍 스케줄 잡 존재 여부 확인 중: ${jobId}`);
          const { data: existingJob, error: checkError } = await getSupabase()
            .from('scheduled_jobs')
            .select('id, status, workflow_id')
            .eq('id', jobId)
            .single();
            
          if (checkError) {
            console.error(`❌🚨 스케줄 잡 조회 실패: ${jobId}`, checkError);
          } else if (!existingJob) {
            console.warn(`⚠️🚨 스케줄 잡이 존재하지 않음: ${jobId}`);
          } else {
            console.log(`📋✅ 스케줄 잡 확인됨: ${jobId}`, existingJob);
            
            // 실제 업데이트 수행
            console.log(`🚨 실제 스케줄 잡 업데이트 수행 중: ${jobId} 🚨`);
            // 🔥 간단하게: 종료 시간을 한국시간대로 명시
            const year = endTime.getFullYear();
            const month = String(endTime.getMonth() + 1).padStart(2, '0');
            const day = String(endTime.getDate()).padStart(2, '0');
            const hours = String(endTime.getHours()).padStart(2, '0');
            const minutes = String(endTime.getMinutes()).padStart(2, '0');
            const seconds = String(endTime.getSeconds()).padStart(2, '0');
            const kstEndTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
            
            // 🔥 반복 스케줄 처리: 스케줄 잡 완료 전에 다음 실행 시간 계산
            console.log(`🔄 반복 스케줄 처리 시작: ${jobId}`);
            let nextScheduleCreated = false;
            
            // 워크플로우 스케줄 설정 확인
            const scheduleConfig = workflow.schedule_config || workflow.scheduleSettings;
            console.log(`📋 스케줄 설정 확인:`, scheduleConfig);
            
            if (scheduleConfig && scheduleConfig.type === 'recurring' && scheduleConfig.recurringPattern) {
              console.log(`🔄 반복 스케줄 감지됨: ${workflow.name}`);
              
              // 🔥 워크플로우 상태 재확인: 실행 완료 시점에 워크플로우가 비활성화되었을 수 있음
              console.log(`🔍 워크플로우 상태 재확인: ${workflow.id}`);
              const { data: currentWorkflow, error: statusCheckError } = await getSupabase()
                .from('workflows')
                .select('status')
                .eq('id', workflow.id)
                .single();
                
              if (statusCheckError) {
                console.error(`❌ 워크플로우 상태 확인 실패: ${workflow.id}`, statusCheckError);
              } else if (currentWorkflow.status !== 'active') {
                console.log(`⏸️ 워크플로우가 비활성 상태로 변경되어 다음 스케줄 등록 건너뜀: ${workflow.name} (상태: ${currentWorkflow.status})`);
              } else {
                console.log(`✅ 워크플로우 활성 상태 확인됨, 다음 스케줄 등록 진행: ${workflow.name}`);
                
                try {
                  // 다음 실행 시간 계산
                  const { frequency, time, daysOfWeek } = scheduleConfig.recurringPattern;
                  console.log(`⏰ 반복 패턴: ${frequency}, 시간: ${time}`);
                  
                  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
                    console.log(`📅 지정된 요일: ${daysOfWeek.map((d: number) => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')}`);
                  }
                  
                  if (time) {
                    // calculateNextKoreaScheduleTime 함수 import 필요
                    const { calculateNextKoreaScheduleTime } = require('@/lib/utils/timezone');
                    const nextScheduledTime = calculateNextKoreaScheduleTime(time, frequency, daysOfWeek);
                    
                    console.log(`📅 다음 실행 시간 계산 완료: ${nextScheduledTime.toISOString()}`);
                    
                    // 🔥 다음 실행 시간을 한국시간대 문자열로 변환
                    const nextYear = nextScheduledTime.getFullYear();
                    const nextMonth = String(nextScheduledTime.getMonth() + 1).padStart(2, '0');
                    const nextDay = String(nextScheduledTime.getDate()).padStart(2, '0');
                    const nextHours = String(nextScheduledTime.getHours()).padStart(2, '0');
                    const nextMinutes = String(nextScheduledTime.getMinutes()).padStart(2, '0');
                    const nextSeconds = String(nextScheduledTime.getSeconds()).padStart(2, '0');
                    const nextKstTimeString = `${nextYear}-${nextMonth}-${nextDay} ${nextHours}:${nextMinutes}:${nextSeconds}+09:00`;
                    
                    console.log(`🔄 다음 스케줄 등록 시작: ${nextKstTimeString}`);
                    
                    // 새로운 스케줄 작업 등록
                    const { data: newScheduleJob, error: scheduleError } = await getSupabase()
                      .from('scheduled_jobs')
                      .insert({
                        workflow_id: workflow.id,
                        workflow_data: {
                          ...workflow,
                          schedule_config: scheduleConfig // 스케줄 설정 유지
                        },
                        scheduled_time: nextKstTimeString,
                        status: 'pending',
                        retry_count: 0,
                        max_retries: 3,
                        created_at: kstEndTimeString,
                        updated_at: kstEndTimeString
                      })
                      .select()
                      .single();
                      
                    if (scheduleError) {
                      console.error(`❌ 다음 스케줄 등록 실패: ${workflow.name}`, scheduleError);
                    } else if (newScheduleJob) {
                      console.log(`✅ 다음 스케줄 등록 성공: ${workflow.name}`, {
                        newJobId: newScheduleJob.id,
                        nextScheduledTime: nextKstTimeString,
                        frequency: frequency
                      });
                      nextScheduleCreated = true;
                    }
                  } else {
                    console.warn(`⚠️ 반복 스케줄에 시간 정보가 없음: ${workflow.name}`);
                  }
                } catch (recurringError) {
                  console.error(`❌ 반복 스케줄 처리 중 오류 발생: ${workflow.name}`, recurringError);
                }
              }
            } else {
              console.log(`📋 일회성 스케줄 또는 반복 설정 없음: ${workflow.name}`);
            }
            
            // 🔥 현재 스케줄 잡 완료 처리 (반복 스케줄 등록 후)
            console.log(`🏁 현재 스케줄 잡 완료 처리: ${jobId}`);
            const { data: updateResult, error: updateError } = await getSupabase()
              .from('scheduled_jobs')
              .update({ 
                status: 'completed',
                
                updated_at: kstEndTimeString
              })
              .eq('id', jobId)
              .select();
              
            if (updateError) {
              console.error(`❌🚨 스케줄 잡 완료 처리 실패: ${jobId}`, updateError);
            } else if (updateResult && updateResult.length > 0) {
              console.log(`✅🚨 스케줄 잡 완료 처리 성공: ${jobId}`, updateResult[0]);
              
              // 반복 스케줄 등록 결과 로그
              if (nextScheduleCreated) {
                console.log(`🔄✅ 반복 스케줄 처리 완료: ${workflow.name} - 다음 실행 시간 등록됨`);
              } else {
                console.log(`📋 일회성 스케줄 완료: ${workflow.name}`);
              }
            } else {
              console.warn(`⚠️🚨 스케줄 잡을 찾을 수 없음: ${jobId}`);
            }
          }
        } else {
          console.log(`📋🚨 스케줄 잡 완료 처리 건너뜀 - scheduledExecution: ${scheduledExecution}, jobId: ${jobId}, webhookExecution: ${webhookExecution}`);
          if (!scheduledExecution) {
            console.log(`📋 scheduledExecution이 false이므로 스케줄 잡 처리 안함`);
          }
          if (!jobId) {
            console.log(`📋 jobId가 없으므로 스케줄 잡 처리 안함`);
          }
          if (webhookExecution) {
            console.log(`📋 웹훅 실행이므로 스케줄 잡 처리 없음`);
          }
        }
        
        console.log(`🚨🚨🚨 워크플로우 실행 완료 후 처리 종료 🚨🚨🚨`);
        
      } catch (postProcessError) {
        console.error(`⚠️🚨🚨🚨 워크플로우 실행 후 처리 중 오류:`, postProcessError);
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
          // 🔥 간단하게: 실패 시간을 한국시간대로 명시
          const year = endTime.getFullYear();
          const month = String(endTime.getMonth() + 1).padStart(2, '0');
          const day = String(endTime.getDate()).padStart(2, '0');
          const hours = String(endTime.getHours()).padStart(2, '0');
          const minutes = String(endTime.getMinutes()).padStart(2, '0');
          const seconds = String(endTime.getSeconds()).padStart(2, '0');
          const kstFailTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+09:00`;
          
          await getSupabase()
            .from('scheduled_jobs')
            .update({ 
              status: 'failed',
              error_message: error instanceof Error ? error.message : '알 수 없는 오류',
              updated_at: kstFailTimeString // 🔥 한국시간대를 명시한 문자열
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
    
    console.log(`🔍 템플릿 조회 시작:`, {
      templateId,
      templateCode,
      hasAction: !!step.action,
      actionKeys: Object.keys(step.action || {}),
      hasTemplates: !!step.templates,
      templatesLength: step.templates?.length || 0
    });
    
    // 🔥 미리보기 API와 동일한 템플릿 조회 로직
    const templateKey = templateId || templateCode;
    console.log(`🔑 템플릿 키: ${templateKey}`);
    
    // 여러 방법으로 템플릿 찾기
    let templateInfo = null;
    
    // 1) 직접 키 매칭
    console.log(`🔍 1단계: 직접 키 매칭 시도 (${templateKey})`);
    console.log(`🔍 KakaoAlimtalkTemplateById 객체 상태:`, {
      totalKeys: Object.keys(KakaoAlimtalkTemplateById).length,
      hasTargetKey: templateKey in KakaoAlimtalkTemplateById,
      sampleKeys: Object.keys(KakaoAlimtalkTemplateById).slice(0, 3),
      targetKeyType: typeof templateKey
    });
    templateInfo = KakaoAlimtalkTemplateById[templateKey as keyof typeof KakaoAlimtalkTemplateById];
    console.log(`📋 1단계 결과:`, !!templateInfo ? '성공' : '실패');
    
    // 1-1) 정확한 템플릿 ID로 재시도
    if (!templateInfo && templateId === 'KA01TP250610072652095M0BPif67w7I') {
      console.log(`🔍 1-1단계: 정확한 템플릿 ID로 재시도`);
      templateInfo = KakaoAlimtalkTemplateById['KA01TP250610072652095M0BPif67w7I'];
      console.log(`📋 1-1단계 결과:`, !!templateInfo ? '성공' : '실패');
      if (templateInfo) {
        console.log(`✅ 직접 매칭 성공:`, templateInfo.templateName);
      }
    }
    
    // 1-2) 81번 템플릿 특별 처리
    if (!templateInfo && templateId === 'KA01TP250211020438703JXjSd4tHP15') {
      console.log(`🔍 1-2단계: 81번 템플릿 특별 처리`);
      templateInfo = KakaoAlimtalkTemplateById['KA01TP250211020438703JXjSd4tHP15'];
      console.log(`📋 1-2단계 결과:`, !!templateInfo ? '성공' : '실패');
      if (templateInfo) {
        console.log(`✅ 81번 템플릿 직접 매칭 성공:`, templateInfo.templateName);
      }
    }
    
    // 2) 81번 템플릿을 특별히 찾기
    if (!templateInfo && (step.templates?.[0]?.templateName?.includes('81.') || step.name?.includes('81.'))) {
      console.log(`🔍 2단계: 81번 템플릿 특별 매칭 시도`);
      const templateEntries = Object.entries(KakaoAlimtalkTemplateById);
      console.log(`📋 총 템플릿 개수: ${templateEntries.length}`);
      for (const [key, tmpl] of templateEntries) {
        if (tmpl.templateName && tmpl.templateName.includes('81.') && tmpl.templateName.includes('도입 문의 완료')) {
          templateInfo = tmpl;
          console.log(`✅ 81번 템플릿 매칭 성공: ${key}`);
          break;
        }
      }
      console.log(`📋 2단계 결과:`, !!templateInfo ? '성공' : '실패');
    }
    
    // 3) 113번 템플릿을 특별히 찾기
    if (!templateInfo && step.templates?.[0]?.templateName?.includes('113.')) {
      console.log(`🔍 3단계: 113번 템플릿 특별 매칭 시도`);
      const templateEntries = Object.entries(KakaoAlimtalkTemplateById);
      console.log(`📋 총 템플릿 개수: ${templateEntries.length}`);
      for (const [key, tmpl] of templateEntries) {
        if (tmpl.templateName && tmpl.templateName.includes('113.') && tmpl.templateName.includes('상위 블로거 참여 O')) {
          templateInfo = tmpl;
          console.log(`✅ 113번 템플릿 매칭 성공: ${key}`);
          break;
        }
      }
      console.log(`📋 3단계 결과:`, !!templateInfo ? '성공' : '실패');
    }
    
    // 4) 템플릿 이름으로 매칭
    if (!templateInfo && step.templates?.[0]?.templateName) {
      console.log(`🔍 4단계: 템플릿 이름 매칭 시도 (${step.templates[0].templateName})`);
      const templateEntries = Object.entries(KakaoAlimtalkTemplateById);
      for (const [key, tmpl] of templateEntries) {
        if (tmpl.templateName === step.templates[0].templateName) {
          templateInfo = tmpl;
          console.log(`✅ 템플릿 이름 매칭 성공: ${key}`);
          break;
        }
      }
      console.log(`📋 4단계 결과:`, !!templateInfo ? '성공' : '실패');
    }
    
    // 5) step.templates에서 직접 사용
    if (!templateInfo && step.templates?.[0]) {
      console.log(`🔍 5단계: step.templates에서 직접 사용`);
      templateInfo = {
        templateName: step.templates[0].templateName || '사용자 정의 템플릿',
        content: step.templates[0].content,
        templateParams: []
      };
      console.log(`✅ 사용자 정의 템플릿 사용: ${templateInfo.templateName}`);
    }
    
    // 6) workflow의 message_config.selectedTemplates에서 찾기
    if (!templateInfo && workflow.message_config?.selectedTemplates) {
      console.log(`🔍 6단계: workflow message_config selectedTemplates에서 템플릿 찾기`);
      const selectedTemplate = workflow.message_config.selectedTemplates.find((tmpl: any) => 
        tmpl.id === templateId || tmpl.templateCode === templateCode
      );
      
      if (selectedTemplate) {
        templateInfo = {
          templateName: selectedTemplate.templateName || selectedTemplate.templateTitle || '선택된 템플릿',
          content: selectedTemplate.templateContent,
          templateParams: selectedTemplate.variables || [],
          templateId: selectedTemplate.id,
          channel: selectedTemplate.channelKey
        };
        console.log(`✅ selectedTemplates에서 템플릿 매칭 성공: ${templateInfo.templateName}`);
      }
    }
    
    // 7) workflowWithSupabaseProps의 message_config.selectedTemplates에서 찾기
    if (!templateInfo && (workflow as any).message_config?.selectedTemplates) {
      console.log(`🔍 7단계: supabase message_config selectedTemplates에서 템플릿 찾기`);
      const selectedTemplate = (workflow as any).message_config.selectedTemplates.find((tmpl: any) => 
        tmpl.id === templateId || tmpl.templateCode === templateCode
      );
      
      if (selectedTemplate) {
        templateInfo = {
          templateName: selectedTemplate.templateName || selectedTemplate.templateTitle || '선택된 템플릿',
          content: selectedTemplate.templateContent,
          templateParams: selectedTemplate.variables || [],
          templateId: selectedTemplate.id,
          channel: selectedTemplate.channelKey
        };
        console.log(`✅ supabase selectedTemplates에서 템플릿 매칭 성공: ${templateInfo.templateName}`);
      }
    }
    
    if (!templateInfo) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateId}`);
    }
    
    console.log(`✅ 템플릿 로드 성공: ${templateInfo.templateName}`);
    
    // 🔥 실제 템플릿 ID 결정 (CoolSMS API 호출용)
    let actualTemplateId = templateId;
    
    // 113번 템플릿인 경우 실제 CoolSMS 템플릿 ID로 변경
    if (templateInfo.templateName?.includes('113.') && templateInfo.templateName?.includes('상위 블로거 참여 O')) {
      actualTemplateId = 'KA01TP250610072652095M0BPif67w7I';
      console.log(`🔄 113번 템플릿 ID 변경: ${templateId} → ${actualTemplateId}`);
    }
    // 다른 템플릿들도 실제 ID로 매핑
    else if (templateInfo.templateId) {
      actualTemplateId = templateInfo.templateId;
      console.log(`🔄 템플릿 ID 업데이트: ${templateId} → ${actualTemplateId}`);
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
          console.log('📋 모든 매핑 목록:', savedMappings.map(m => ({
            variable_name: m.variable_name,
            source_type: m.source_type,
            key_column: m.key_column,
            selected_column: m.selected_column
          })));
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

    console.log('🌐 베이스 URL:', baseUrl);
    console.log('🔍 매핑 데이터 확인:', {
      savedMappingsLength: savedMappings.length,
      firstMapping: savedMappings.length > 0 ? savedMappings[0] : null
    });

    if (savedMappings.length > 0) {
      console.log('🔍 변수 쿼리 실행 시작...');
      
      for (const mapping of savedMappings) {
        console.log(`📊 매핑 처리 중: ${mapping.variable_name}`, {
          sourceType: mapping.source_type,
          hasSourceField: !!mapping.source_field,
          alreadyCached: variableDataCache.has(mapping.variable_name)
        });
        
        if (mapping.source_type === 'query' && mapping.source_field && !variableDataCache.has(mapping.variable_name)) {
          try {
            console.log(`📊 변수 쿼리 실행: ${mapping.variable_name}`);
            console.log(`📝 쿼리: ${mapping.source_field}`);
            
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

            console.log(`📡 MySQL API 응답 상태: ${variableResponse.status}`);

            if (variableResponse.ok) {
              const variableResult = await variableResponse.json();
              console.log(`📊 변수 쿼리 결과:`, {
                success: variableResult.success,
                hasData: !!variableResult.data,
                dataType: typeof variableResult.data,
                dataLength: variableResult.data?.length || 0
              });
              
              // 🔥 MySQL API 응답 구조 처리: data가 배열인지 확인
              let variableData = [];
              if (variableResult.success && variableResult.data) {
                if (Array.isArray(variableResult.data)) {
                  variableData = variableResult.data;
                } else if (variableResult.data.rows && Array.isArray(variableResult.data.rows)) {
                  variableData = variableResult.data.rows;
                } else if (variableResult.data.data && Array.isArray(variableResult.data.data)) {
                  variableData = variableResult.data.data;
                }
              }
              
              if (variableData.length > 0) {
                variableDataCache.set(mapping.variable_name, variableData);
                console.log(`✅ 변수 쿼리 성공: ${mapping.variable_name} (${variableData.length}개 행)`);
                console.log(`📊 샘플 데이터:`, variableData.slice(0, 2));
                console.log(`📊 첫 번째 행의 컬럼들:`, Object.keys(variableData[0] || {}));
              } else {
                console.log(`❌ 변수 쿼리 결과 없음: ${mapping.variable_name}`);
              }
            } else {
              const errorText = await variableResponse.text();
              console.error(`❌ 변수 쿼리 API 호출 실패: ${mapping.variable_name} (${variableResponse.status})`);
              console.error(`❌ 오류 내용:`, errorText);
            }
          } catch (queryError) {
            console.error(`❌ 변수 쿼리 실행 오류 (${mapping.variable_name}):`, queryError);
          }
        }
      }
    } else {
      console.log('⚠️ 저장된 매핑이 없습니다. 기본값만 사용됩니다.');
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
          'company_name': target.rawData?.company || target.rawData?.companyName || target.name || '회사명 없음',
        };

        // 🔥 Feature_Workflow_Builder.md 4.1.1 범용적 매칭 시스템
        // AA열(변수 쿼리의 매칭 컬럼) ↔ BB열(대상자 쿼리의 매칭 컬럼) 매칭
        if (savedMappings.length > 0) {
          const contact = target.rawData || target;
          console.log(`👤 대상자 정보:`, {
            name: target.name,
            id: target.id,
            phoneNumber: target.phoneNumber,
            contactKeys: Object.keys(contact),
            contactData: contact
          });
          
          // 🔥 각 대상자별로 개별 변수 쿼리 실행 (동적 필터링)
          for (const mapping of savedMappings) {
            if (mapping.source_type === 'query' && mapping.source_field) {
              
              // BB열: 대상자 쿼리의 매칭 컬럼 (기본값: id)
              const rawKeyColumn = mapping.key_column?.replace(/^[a-zA-Z]+\./, '') || 'id';
              const targetMatchingValue = contact[rawKeyColumn] || contact.id || target.id;
              
              console.log(`🎯 대상자별 변수 쿼리 실행: ${mapping.variable_name}`);
              console.log(`📋 대상자 매칭 값: ${targetMatchingValue} (컬럼: ${rawKeyColumn})`);
              
              try {
                // 🔥 동적 WHERE 조건 추가하여 대상자별 데이터만 조회
                let dynamicQuery = mapping.source_field;
                
                // 기존 쿼리에 WHERE 조건이 있는지 확인
                if (dynamicQuery.toLowerCase().includes('where')) {
                  // 기존 WHERE 조건에 AND 추가
                  dynamicQuery = dynamicQuery.replace(/where/i, `WHERE a.id = ${targetMatchingValue} AND`);
                } else {
                  // WHERE 조건 추가
                  if (dynamicQuery.toLowerCase().includes('group by')) {
                    dynamicQuery = dynamicQuery.replace(/group by/i, `WHERE a.id = ${targetMatchingValue} GROUP BY`);
                  } else {
                    dynamicQuery += ` WHERE a.id = ${targetMatchingValue}`;
                  }
                }
                
                console.log(`📝 동적 쿼리: ${dynamicQuery}`);
                
                const variableResponse = await fetch(`${baseUrl}/api/mysql/query`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
                  },
                  body: JSON.stringify({ query: dynamicQuery })
                });
                
                const variableResult = await variableResponse.json();
                
                console.log(`📊 대상자별 변수 쿼리 응답:`, {
                  success: variableResult.success,
                  hasData: !!variableResult.data,
                  dataType: typeof variableResult.data,
                  dataLength: variableResult.data?.length
                });

                // 🔥 MySQL API 응답 구조 처리: data가 배열인지 확인
                let variableData = [];
                if (variableResult.success && variableResult.data) {
                  if (Array.isArray(variableResult.data)) {
                    variableData = variableResult.data;
                  } else if (variableResult.data.rows && Array.isArray(variableResult.data.rows)) {
                    variableData = variableResult.data.rows;
                  } else if (variableResult.data.data && Array.isArray(variableResult.data.data)) {
                    variableData = variableResult.data.data;
                  }
                }
                
                if (variableData.length > 0) {
                  console.log(`✅ 대상자별 변수 데이터 조회 성공: ${variableData.length}개`);
                  
                  // 첫 번째 결과 사용 (대상자별로 필터링되었으므로 정확한 데이터)
                  const matchedRow = variableData[0];
                  const personalizedValue = matchedRow[mapping.selected_column];
                  
                  // 🔥 미리보기 API와 동일하게 변수명 그대로 사용 (#{total_reviews} 형태 유지)
                  personalizedVariables[mapping.variable_name] = String(personalizedValue || mapping.default_value || '--');
                  
                  console.log(`🔗 대상자별 매칭 성공: ${mapping.variable_name} = "${personalizedValue}"`);
                } else {
                  console.log(`⚠️ 대상자별 변수 데이터 없음: ${mapping.variable_name}`);
                  const defaultValue = mapping.default_value || '--';
                  personalizedVariables[mapping.variable_name] = defaultValue;
                  console.log(`🎲 기본값 사용: ${mapping.variable_name} = "${defaultValue}"`);
                }
                
              } catch (error) {
                console.error(`❌ 대상자별 변수 쿼리 실행 실패: ${mapping.variable_name}`, error);
                const defaultValue = mapping.default_value || '--';
                personalizedVariables[mapping.variable_name] = defaultValue;
              }
            }
          }
        }

        // 🔥 템플릿에서 실제 변수 패턴만 찾기 (#{변수명} 형태만)
        let processedContent = templateInfo.content;
        const templateVariableMatches = processedContent.match(/#{([^}]+)}/g) || [];
        
        console.log(`🔍 템플릿에서 발견된 변수: ${templateVariableMatches.length}개`, templateVariableMatches);
        
        // 🔥 템플릿에 실제로 존재하지 않는 변수들을 personalizedVariables에서 제거
        const templateVariableNames = templateVariableMatches.map(v => v);
        Object.keys(personalizedVariables).forEach(key => {
          if (key.startsWith('#{') && !templateVariableNames.includes(key)) {
            console.log(`🗑️ 템플릿에 없는 변수 제거: ${key}`);
            delete personalizedVariables[key];
          }
        });
              
        // 발견된 모든 변수에 대해 기본값 설정
        templateVariableMatches.forEach(fullVar => {
          // 매칭된 실제 값이 없는 경우에만 기본값 사용
          if (personalizedVariables[fullVar] === undefined) {
            // 워크플로우에서 설정한 기본값 또는 '--' 사용
            personalizedVariables[fullVar] = '--';
            console.log(`🎲 기본값 사용: ${fullVar} = "--"`);
          }
        });

        // 🔥 변수 치환 (매칭된 실제 값 우선 사용)
        templateVariableMatches.forEach(fullVar => {
          const replacementValue = personalizedVariables[fullVar] || '--';
          processedContent = processedContent.replace(new RegExp(fullVar.replace(/[{}]/g, '\\$&'), 'g'), replacementValue);
        });

        console.log(`📤 대상자: ${target.name} (${target.phoneNumber})`);
        console.log(`📋 최종 개인화 변수:`, personalizedVariables);

        const result = await sendAlimtalk({
          templateId: actualTemplateId,
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
          templateId: null, // 🔥 template_id는 UUID 형식이어야 하므로 일단 null로 처리
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
          templateId: null, // 🔥 template_id는 UUID 형식이어야 하므로 일단 null로 처리
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
    // 🔥 웹훅 타입: 이벤트 데이터에서 직접 대상자 생성
    if (targetGroup.type === 'webhook' && targetGroup.webhookEventData) {
      const eventData = targetGroup.webhookEventData;
      console.log('🔔 웹훅 이벤트 데이터에서 대상자 생성:', eventData);
      
      // 웹훅 이벤트 데이터를 대상자 형식으로 변환
      const phoneNumber = eventData.phone || eventData.phoneNumber || eventData.contact || '01000000000';
      const name = eventData.name || eventData.company || '웹훅 대상자';
      const email = eventData.email || null;
      
      return [{
        id: 'webhook_target',
        name: name,
        phoneNumber: phoneNumber,
        email: email,
        rawData: eventData // 웹훅 이벤트 데이터를 원본 데이터로 사용
      }];
    }
    
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
        console.log(`📋 MySQL API 응답:`, { success: result.success, hasData: !!result.data, dataType: typeof result.data, dataLength: result.data?.length });
      
        if (!result.success || !result.data) {
          console.warn(`⚠️ 대상자 조회 결과 없음 - API 실패 또는 데이터 없음`);
          return [];
        }

        // 🔥 MySQL API 응답 구조 처리: data가 배열인지 확인
        let contacts = [];
        if (Array.isArray(result.data)) {
          contacts = result.data;
        } else if (result.data.rows && Array.isArray(result.data.rows)) {
          contacts = result.data.rows;
        } else if (result.data.data && Array.isArray(result.data.data)) {
          contacts = result.data.data;
        } else {
          console.warn(`⚠️ 예상하지 못한 데이터 구조:`, result.data);
          return [];
        }

        if (contacts.length === 0) {
          console.warn(`⚠️ 대상자 조회 결과 없음 - 빈 배열`);
          return [];
        }

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

  // 🔥 전화번호 정리: 숫자만 남기고 최대 25자로 제한
  const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '').slice(0, 25);
  console.log(`📞 전화번호 정리: ${phoneNumber} → ${cleanPhoneNumber}`);

  // CoolSMS API에 맞는 변수 형식으로 변환: 
  // variables 객체에 이미 #{변수명} 형태로 저장되어 있으므로 그대로 사용
  const coolsmsVariables: Record<string, string> = {};
  Object.entries(variables).forEach(([key, value]) => {
    // key가 이미 #{변수명} 형태이므로 그대로 사용
    coolsmsVariables[key] = value;
  });

  // 변수 치환된 메시지 내용 생성 (로깅용)
  const processedContent = templateContent.replace(/#{(\w+)}/g, (match, key) => variables[key] || match);

  const messageData = {
    to: cleanPhoneNumber, // 🔥 정리된 전화번호 사용
    from: SMS_SENDER_NUMBER,
    type: 'ATA',
    kakaoOptions: {
      pfId: pfId,
      templateId: templateId,
      variables: coolsmsVariables // CoolSMS API에 맞는 형식으로 전달
    }
  };

  console.log(`📱 실제 알림톡 발송: ${cleanPhoneNumber} - 템플릿: ${templateId}`);
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