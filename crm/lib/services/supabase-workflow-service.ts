import { getSupabase } from '@/lib/database/supabase-client';
import type { Workflow, WorkflowExecution, WorkflowLog } from '@/lib/types/workflow';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseWorkflow {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_type: string;
  trigger_config: any;
  target_config: any;
  message_config: any;
  variables: any;
  schedule_config: any;
  statistics: any;
  last_run_at?: string;
  next_run_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseWorkflowRun {
  id: string;
  workflow_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  trigger_type?: string;
  target_count: number;
  success_count: number;
  failed_count: number;
  total_cost: number;
  error_message?: string;
  execution_time_ms?: number;
  started_at: string;
  completed_at?: string;
  logs: any[];
}

export interface SupabaseMessageLog {
  id: string;
  workflow_id?: string;
  workflow_name?: string;
  template_id?: string;
  template_name?: string;
  message_type: 'sms' | 'kakao' | 'email' | 'push';
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name?: string;
  message_content: string;
  variables: any;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'read';
  provider?: string;
  provider_message_id?: string;
  error_message?: string;
  cost_amount?: number;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

// 커스텀 쿼리 타입 정의
interface CustomQuery {
  id?: string;
  query_name: string;
  display_name: string;
  description?: string;
  query_sql: string;
  variables?: any[];
  enabled?: boolean;
  category?: 'general' | 'analytics' | 'reporting' | 'marketing';
  usage_count?: number;
  last_used_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

interface CustomQueryLog {
  id?: string;
  query_id: string;
  executed_by?: string;
  execution_time_ms?: number;
  result_count?: number;
  success?: boolean;
  error_message?: string;
  executed_at?: string;
}

class SupabaseWorkflowService {
  private getClient(): SupabaseClient {
    try {
      return getSupabase();
    } catch (error) {
      throw new Error('Supabase client가 초기화되지 않았습니다. 환경변수를 확인해주세요.');
    }
  }

  private async ensureTables() {
    const client = this.getClient();

    // 테이블 존재 확인 및 생성은 이미 supabase_hybrid_schema.sql에서 처리됨
    // 여기서는 연결만 확인
    try {
      const { data, error } = await client
        .from('workflows')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        throw new Error('워크플로우 테이블이 존재하지 않습니다. 스키마를 먼저 실행해주세요.');
      }
    } catch (error: any) {
      console.error('테이블 확인 중 오류:', error);
      // 테이블이 없는 경우가 아니라면 다른 오류이므로 그대로 throw
      if (error.code !== 'PGRST116') {
        throw error;
      }
    }
  }

  // =====================================================
  // 워크플로우 관리 메서드
  // =====================================================

  // 워크플로우 생성
  async createWorkflow(workflow: Workflow): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      console.log('📝 워크플로우 생성 요청 데이터:', workflow);

      const { data, error } = await client
        .from('workflows')
        .insert([{
          name: workflow.name,
          description: workflow.description,
          status: workflow.status || 'draft',
          trigger_type: workflow.trigger?.type || 'manual',
          trigger_config: {
            id: workflow.trigger?.id,
            name: workflow.trigger?.name,
            description: workflow.trigger?.description,
            conditions: workflow.trigger?.conditions || [],
            conditionLogic: workflow.trigger?.conditionLogic || 'AND'
          },
          target_config: {
            targetGroups: workflow.targetGroups || [],
            targetTemplateMappings: workflow.targetTemplateMappings || []
          },
          message_config: {
            steps: workflow.steps || []
          },
          variables: {
            testSettings: workflow.testSettings || {},
            scheduleSettings: workflow.scheduleSettings || {}
          },
          schedule_config: workflow.scheduleSettings || {},
          created_by: 'system'
        }])
        .select()
        .single();

      if (error) {
        console.error('워크플로우 생성 오류:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ 워크플로우 생성 성공:', data);
      return { success: true, data };
    } catch (error) {
      console.error('워크플로우 생성 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 목록 조회
  async getWorkflows(limit = 50, offset = 0): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('workflows')
        .select(`
          id, name, description, status, trigger_type, trigger_config,
          target_config, message_config, mapping_config, variables,
          created_at, updated_at, last_run_at, next_run_at,
          statistics, schedule_config, schedule_settings, created_by
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('워크플로우 목록 조회 오류:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Supabase에서 조회된 워크플로우:', data?.length || 0, '개');
      console.log('📋 첫 번째 워크플로우 데이터:', data?.[0]);

      // 🔥 스케줄 필드 동기화 처리
      const normalizedData = data?.map(workflow => this.normalizeScheduleFields(workflow)) || [];

      return { success: true, data: normalizedData };
    } catch (error) {
      console.error('워크플로우 목록 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 상세 조회
  async getWorkflow(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('워크플로우 조회 오류:', error);
        return { success: false, error: error.message };
      }

      // 🔥 스케줄 필드 동기화 처리
      const normalizedData = data ? this.normalizeScheduleFields(data) : null;

      return { success: true, data: normalizedData };
    } catch (error) {
      console.error('워크플로우 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 업데이트
  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      console.log('📝 워크플로우 업데이트 요청:', { id, updates });

      const updateData: any = {};
      
      // 기본 필드들
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status) updateData.status = updates.status;
      
      // 트리거 설정
      if (updates.trigger) {
        updateData.trigger_type = updates.trigger.type;
        updateData.trigger_config = {
          id: updates.trigger.id,
          name: updates.trigger.name,
          description: updates.trigger.description,
          conditions: updates.trigger.conditions || [],
          conditionLogic: updates.trigger.conditionLogic || 'AND'
        };
      }
      
      // 🔥 대상 설정 - targetGroups를 target_config로 변환
      if (updates.targetGroups && Array.isArray(updates.targetGroups)) {
        console.log('🎯 대상 그룹 설정 감지:', updates.targetGroups);
        
        // 기존 target_config 조회하여 다른 필드들 보존
        const { data: existingWorkflow } = await client
          .from('workflows')
          .select('target_config')
          .eq('id', id)
          .single();
          
        updateData.target_config = {
          targetGroups: updates.targetGroups,
          // 기존 targetTemplateMappings는 보존 (mapping_config로 이동 예정)
          targetTemplateMappings: existingWorkflow?.target_config?.targetTemplateMappings || []
        };
      }
      
      // 🔥 3단계: 매핑 설정 처리 (mapping_config)
      if (updates.targetTemplateMappings) {
        console.log('🎯 매핑 설정 감지:', updates.targetTemplateMappings);
        updateData.mapping_config = {
          targetTemplateMappings: updates.targetTemplateMappings
        };
        
        // 하위 호환성: target_config에서도 제거하지 않고 동기화
        if (!updateData.target_config) {
          const { data: existingWorkflow } = await client
            .from('workflows')
            .select('target_config')
            .eq('id', id)
            .single();
            
          updateData.target_config = {
            targetGroups: existingWorkflow?.target_config?.targetGroups || [],
            targetTemplateMappings: updates.targetTemplateMappings
          };
        } else {
          updateData.target_config.targetTemplateMappings = updates.targetTemplateMappings;
        }
      }
      
      // 대상-템플릿 매핑만 업데이트하는 경우 (레거시)
      if (updates.targetTemplateMappings && !updates.targetGroups && !updateData.target_config) {
        // 기존 target_config 조회
        const { data: existingWorkflow } = await client
          .from('workflows')
          .select('target_config')
          .eq('id', id)
          .single();
          
        updateData.target_config = {
          targetGroups: existingWorkflow?.target_config?.targetGroups || [],
          targetTemplateMappings: updates.targetTemplateMappings
        };
      }
      
      // 메시지 설정
      if (updates.steps) {
        updateData.message_config = {
          steps: updates.steps
        };
      }
      
      // 스케줄 설정 (가장 중요한 부분)
      if (updates.scheduleSettings) {
        console.log('⏰ 스케줄 설정 업데이트:', updates.scheduleSettings);
        
        // 1. 메인 스케줄 설정 필드 업데이트
        updateData.schedule_config = updates.scheduleSettings;
        
        // 2. 레거시 schedule_settings 필드도 업데이트 (호환성 유지)
        updateData.schedule_settings = updates.scheduleSettings;
        
        // 3. variables 내부의 scheduleSettings도 업데이트
        // 🔥 기존 variables를 보존하면서 scheduleSettings만 업데이트
        if (!updateData.variables) {
          // 기존 variables 조회
          try {
            const { data: currentWorkflow } = await client
              .from('workflows')
              .select('variables')
              .eq('id', id)
              .single();
            updateData.variables = currentWorkflow?.variables || {};
          } catch (error) {
            updateData.variables = {};
          }
        }
        updateData.variables.scheduleSettings = updates.scheduleSettings;
        
        // 4. message_config 내부의 steps에서도 scheduleSettings 업데이트
        // 기존 message_config가 있는 경우 해당 데이터를 가져와서 업데이트
        try {
          const { data: currentWorkflow } = await client
            .from('workflows')
            .select('message_config')
            .eq('id', id)
            .single();
            
          if (currentWorkflow?.message_config?.steps) {
            const updatedSteps = currentWorkflow.message_config.steps.map((step: any) => {
              if (step.action) {
                return {
                  ...step,
                  action: {
                    ...step.action,
                    scheduleSettings: updates.scheduleSettings
                  }
                };
              }
              return step;
            });
            
            updateData.message_config = {
              ...currentWorkflow.message_config,
              steps: updatedSteps
            };
            
            console.log('📝 message_config 스케줄 설정 업데이트:', {
              stepsCount: updatedSteps.length,
              firstStepSchedule: updatedSteps[0]?.action?.scheduleSettings
            });
          }
        } catch (error) {
          console.warn('⚠️ message_config 업데이트 중 오류:', error);
        }
        
        // 5. 새로운 steps가 전달된 경우에도 scheduleSettings 업데이트
        if (updates.steps && Array.isArray(updates.steps)) {
          const updatedSteps = updates.steps.map(step => {
            if (step.action) {
              return {
                ...step,
                action: {
                  ...step.action,
                  scheduleSettings: updates.scheduleSettings
                }
              };
            }
            return step;
          });
          
          updateData.message_config = {
            ...updateData.message_config,
            steps: updatedSteps
          };
        }
        
        console.log('📝 스케줄 설정 업데이트 완료:', {
          schedule_config: updateData.schedule_config,
          schedule_settings: updateData.schedule_settings,
          variables_scheduleSettings: updateData.variables?.scheduleSettings,
          message_config_updated: !!updateData.message_config
        });
      }
      
      // 🔥 testSettings 별도 처리 (기존 variables 보존)
      if (updates.testSettings) {
        if (!updateData.variables) {
          // 기존 variables 조회
          try {
            const { data: currentWorkflow } = await client
              .from('workflows')
              .select('variables')
              .eq('id', id)
              .single();
            updateData.variables = currentWorkflow?.variables || {};
          } catch (error) {
            updateData.variables = {};
          }
        }
        updateData.variables.testSettings = updates.testSettings;
      }
      
      // 레거시 필드들 (호환성을 위해)
      if ((updates as any).triggerType) updateData.trigger_type = (updates as any).triggerType;
      if ((updates as any).triggerConfig) updateData.trigger_config = (updates as any).triggerConfig;
      if ((updates as any).targetConfig) updateData.target_config = (updates as any).targetConfig;
      if ((updates as any).messageConfig) updateData.message_config = (updates as any).messageConfig;
      if ((updates as any).variables) updateData.variables = (updates as any).variables;
      if ((updates as any).scheduleConfig) updateData.schedule_config = (updates as any).scheduleConfig;

      console.log('📝 Supabase 업데이트 데이터:', updateData);

      const { data, error } = await client
        .from('workflows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('워크플로우 업데이트 오류:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ 워크플로우 업데이트 성공:', data);

      // 🔥 스케줄 등록이 필요한 경우 통합 처리
      const hasScheduleUpdate = updates.scheduleSettings || (updates as any).scheduleConfig || (updates as any).schedule_config;
      const isActivating = updates.status === 'active';
      const isActiveWorkflow = data.status === 'active';
      const hasScheduleConfig = data.schedule_config && data.schedule_config.type !== 'immediate';
      
      // 스케줄 등록 조건: (스케줄 변경 + 활성 상태) 또는 (활성화 + 스케줄 있음)
      const shouldRegisterSchedule = (hasScheduleUpdate && (isActivating || isActiveWorkflow)) || (isActivating && hasScheduleConfig);
      
      if (shouldRegisterSchedule) {
        console.log('🔄 워크플로우 스케줄 등록 필요:', {
          hasScheduleUpdate,
          isActivating,
          isActiveWorkflow,
          hasScheduleConfig,
          scheduleType: data.schedule_config?.type
        });
        
        try {
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.vercel.app')
            : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

          console.log('📡 통합 스케줄 등록 API 호출:', `${baseUrl}/api/scheduler/register`);
          const registerResponse = await fetch(`${baseUrl}/api/scheduler/register`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              // Vercel Protection Bypass 헤더 추가
              'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
              'x-vercel-set-bypass-cookie': 'true'
            }
          });

          if (registerResponse.ok) {
            const registerResult = await registerResponse.json();
            console.log('✅ 통합 스케줄 등록 성공:', registerResult.message);
          } else {
            const errorText = await registerResponse.text();
            console.warn('⚠️ 통합 스케줄 등록 실패:', errorText);
          }
        } catch (registerError) {
          console.warn('⚠️ 통합 스케줄 등록 중 오류:', registerError);
          // 스케줄 등록 실패는 워크플로우 업데이트 성공에 영향을 주지 않음
        }
      }

      return { success: true, data };
    } catch (error) {
      console.error('워크플로우 업데이트 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 삭제
  async deleteWorkflow(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { error } = await client
        .from('workflows')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('워크플로우 삭제 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('워크플로우 삭제 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 통계 조회
  async getWorkflowStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      // 기본 워크플로우 통계
      const { data: workflows, error: workflowError } = await client
        .from('workflows')
        .select('id, status, created_at, last_run_at');

      if (workflowError) {
        return { success: false, error: workflowError.message };
      }

      // 워크플로우 실행 기록 통계
      const { data: runs, error: runsError } = await client
        .from('workflow_runs')
        .select('id, status, started_at, completed_at, success_count, failed_count');

      if (runsError) {
        return { success: false, error: runsError.message };
      }

      // 메시지 로그 통계
      const { data: messages, error: messagesError } = await client
        .from('message_logs')
        .select('id, status, sent_at, cost_amount');

      if (messagesError) {
        return { success: false, error: messagesError.message };
      }

      const stats = {
        totalWorkflows: workflows?.length || 0,
        activeWorkflows: workflows?.filter(w => w.status === 'active').length || 0,
        pausedWorkflows: workflows?.filter(w => w.status === 'paused').length || 0,
        draftWorkflows: workflows?.filter(w => w.status === 'draft').length || 0,
        
        totalRuns: runs?.length || 0,
        completedRuns: runs?.filter(r => r.status === 'completed').length || 0,
        failedRuns: runs?.filter(r => r.status === 'failed').length || 0,
        runningRuns: runs?.filter(r => r.status === 'running').length || 0,
        
        totalMessages: messages?.length || 0,
        sentMessages: messages?.filter(m => m.status === 'sent' || m.status === 'delivered').length || 0,
        failedMessages: messages?.filter(m => m.status === 'failed').length || 0,
        
        totalCost: messages?.reduce((sum, m) => sum + (m.cost_amount || 0), 0) || 0,
        
        lastRunAt: workflows?.reduce((latest, w) => {
          if (!w.last_run_at) return latest;
          const runTime = new Date(w.last_run_at);
          return !latest || runTime > latest ? runTime : latest;
        }, null as Date | null)?.toISOString()
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('워크플로우 통계 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 실행 통계 조회 (스케줄러용)
  async getExecutionStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      // 1. 전체 워크플로우 수
      const { count: totalWorkflows } = await client
        .from('workflows')
        .select('*', { count: 'exact', head: true });

      // 2. 활성 워크플로우 수
      const { count: activeWorkflows } = await client
        .from('workflows')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // 3. 스케줄된 워크플로우 수 (recurring이나 scheduled 타입)
      const { count: scheduledWorkflows } = await client
        .from('workflows')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('trigger_type', 'schedule');

      // 4. 최근 실행 기록 조회 (workflow_runs 테이블이 있다면)
      let recentExecutions = 0;
      let totalExecutions = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;

      try {
        // 전체 실행 수
        const { count: totalRuns } = await client
          .from('workflow_runs')
          .select('*', { count: 'exact', head: true });

        // 성공한 실행 수
        const { count: successRuns } = await client
          .from('workflow_runs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');

        // 실패한 실행 수
        const { count: failedRuns } = await client
          .from('workflow_runs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed');

        // 최근 24시간 실행 수
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { count: recentRuns } = await client
          .from('workflow_runs')
          .select('*', { count: 'exact', head: true })
          .gte('started_at', yesterday.toISOString());

        totalExecutions = totalRuns || 0;
        successfulExecutions = successRuns || 0;
        failedExecutions = failedRuns || 0;
        recentExecutions = recentRuns || 0;
      } catch (error) {
        // workflow_runs 테이블이 없거나 접근할 수 없는 경우 0으로 설정
        console.log('workflow_runs 테이블 접근 불가, 기본값 사용');
      }

      // 5. 메시지 전송 통계 (message_logs 테이블이 있다면)
      let totalMessages = 0;
      let sentMessages = 0;
      let failedMessages = 0;

      try {
        const { count: totalMsgs } = await client
          .from('message_logs')
          .select('*', { count: 'exact', head: true });

        const { count: sentMsgs } = await client
          .from('message_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'sent');

        const { count: failedMsgs } = await client
          .from('message_logs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed');

        totalMessages = totalMsgs || 0;
        sentMessages = sentMsgs || 0;
        failedMessages = failedMsgs || 0;
      } catch (error) {
        // message_logs 테이블이 없거나 접근할 수 없는 경우 0으로 설정
        console.log('message_logs 테이블 접근 불가, 기본값 사용');
      }

      const stats = {
        totalWorkflows: totalWorkflows || 0,
        activeWorkflows: activeWorkflows || 0,
        scheduledWorkflows: scheduledWorkflows || 0,
        executions: {
          total: totalExecutions,
          recent24h: recentExecutions,
          successful: successfulExecutions,
          failed: failedExecutions,
          successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(1) : '0'
        },
        messages: {
          total: totalMessages,
          sent: sentMessages,
          failed: failedMessages,
          successRate: totalMessages > 0 ? (sentMessages / totalMessages * 100).toFixed(1) : '0'
        }
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('실행 통계 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 스케줄된 작업 조회
  async getScheduledJobs(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from('scheduled_jobs')
        .select('*')
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('스케줄된 작업 조회 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('스케줄된 작업 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // =====================================================
  // 워크플로우 실행 기록 관리 메서드
  // =====================================================

  // 워크플로우 실행 기록 생성
  async createWorkflowRun(workflowRun: {
    id: string;
    workflowId: string;
    status: string;
    triggerType?: string;
    targetCount: number;
    successCount: number;
    failedCount: number;
    totalCost: number;
    executionTimeMs?: number;
    startedAt: string;
    completedAt?: string;
    errorMessage?: string;
    logs: any[];
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('workflow_runs')
        .insert([{
          id: workflowRun.id,
          workflow_id: workflowRun.workflowId,
          status: workflowRun.status,
          trigger_type: workflowRun.triggerType,
          target_count: workflowRun.targetCount,
          success_count: workflowRun.successCount,
          failed_count: workflowRun.failedCount,
          total_cost: workflowRun.totalCost,
          execution_time_ms: workflowRun.executionTimeMs,
          started_at: workflowRun.startedAt,
          completed_at: workflowRun.completedAt,
          error_message: workflowRun.errorMessage,
          logs: workflowRun.logs
        }])
        .select()
        .single();

      if (error) {
        console.error('워크플로우 실행 기록 생성 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('워크플로우 실행 기록 생성 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // =====================================================
  // 커스텀 쿼리 관리 메서드 (NEW)
  // =====================================================

  // 커스텀 쿼리 생성
  async createCustomQuery(query: CustomQuery): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('custom_queries')
        .insert([{
          query_name: query.query_name,
          display_name: query.display_name,
          description: query.description,
          query_sql: query.query_sql,
          variables: query.variables || [],
          enabled: query.enabled !== false,
          category: query.category || 'general',
          created_by: query.created_by || 'system'
        }])
        .select()
        .single();

      if (error) {
        console.error('커스텀 쿼리 생성 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('커스텀 쿼리 생성 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 커스텀 쿼리 목록 조회
  async getCustomQueries(limit = 50, offset = 0): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('custom_queries')
        .select(`
          id, query_name, display_name, description, 
          variables, enabled, category, usage_count,
          last_used_at, created_at, updated_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('커스텀 쿼리 목록 조회 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('커스텀 쿼리 목록 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 커스텀 쿼리 상세 조회
  async getCustomQuery(queryName: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('custom_queries')
        .select('*')
        .eq('query_name', queryName)
        .single();

      if (error) {
        console.error('커스텀 쿼리 조회 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('커스텀 쿼리 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 커스텀 쿼리 업데이트
  async updateCustomQuery(queryName: string, updates: Partial<CustomQuery>): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const updateData: any = {};
      if (updates.display_name) updateData.display_name = updates.display_name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.query_sql) updateData.query_sql = updates.query_sql;
      if (updates.variables) updateData.variables = updates.variables;
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.category) updateData.category = updates.category;

      const { data, error } = await client
        .from('custom_queries')
        .update(updateData)
        .eq('query_name', queryName)
        .select()
        .single();

      if (error) {
        console.error('커스텀 쿼리 업데이트 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('커스텀 쿼리 업데이트 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 커스텀 쿼리 삭제
  async deleteCustomQuery(queryName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { error } = await client
        .from('custom_queries')
        .delete()
        .eq('query_name', queryName);

      if (error) {
        console.error('커스텀 쿼리 삭제 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('커스텀 쿼리 삭제 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 커스텀 쿼리 실행 로그 기록
  async logCustomQueryExecution(log: CustomQueryLog): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('custom_query_logs')
        .insert([{
          query_id: log.query_id,
          executed_by: log.executed_by || 'system',
          execution_time_ms: log.execution_time_ms,
          result_count: log.result_count || 0,
          success: log.success !== false,
          error_message: log.error_message
        }])
        .select()
        .single();

      if (error) {
        console.error('쿼리 실행 로그 기록 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('쿼리 실행 로그 기록 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 커스텀 쿼리 실행 통계 조회
  async getCustomQueryStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      // 전체 쿼리 통계
      const { data: totalStats, error: totalError } = await client
        .from('custom_queries')
        .select('enabled, category')
        .then(result => {
          if (result.error) return result;
          
          const stats = result.data?.reduce((acc: any, query: any) => {
            acc.total = (acc.total || 0) + 1;
            acc.enabled = (acc.enabled || 0) + (query.enabled ? 1 : 0);
            acc.disabled = (acc.disabled || 0) + (query.enabled ? 0 : 1);
            acc.categories = acc.categories || {};
            acc.categories[query.category] = (acc.categories[query.category] || 0) + 1;
            return acc;
          }, {}) || {};

          return { data: stats, error: null };
        });

      if (totalError) {
        return { success: false, error: totalError.message };
      }

      // 최근 실행 로그
      const { data: recentLogs, error: logsError } = await client
        .from('custom_query_logs')
        .select(`
          executed_at, execution_time_ms, result_count, success,
          custom_queries!inner(query_name, display_name)
        `)
        .order('executed_at', { ascending: false })
        .limit(10);

      if (logsError) {
        return { success: false, error: logsError.message };
      }

      return {
        success: true,
        data: {
          totalStats,
          recentLogs: recentLogs || []
        }
      };
    } catch (error) {
      console.error('커스텀 쿼리 통계 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // =====================================================
  // 변수 매핑 템플릿 관리 메서드 (NEW)
  // =====================================================

  // 변수 매핑 템플릿 생성
  async createVariableMappingTemplate(template: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('variable_mapping_templates')
        .insert([{
          name: template.name,
          description: template.description,
          category: template.category || 'general',
          tags: template.tags || [],
          variable_mappings: template.variableMappings || [],
          usage_count: template.usageCount || 0,
          last_used_at: template.lastUsedAt,
          is_public: template.isPublic || false,
          is_favorite: template.isFavorite || false,
          created_by: template.createdBy || 'system'
        }])
        .select()
        .single();

      if (error) {
        console.error('변수 매핑 템플릿 생성 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('변수 매핑 템플릿 생성 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 변수 매핑 템플릿 목록 조회
  async getVariableMappingTemplates(filter?: any): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      let query = client
        .from('variable_mapping_templates')
        .select('*')
        .order('created_at', { ascending: false });

      // 필터 적용
      if (filter?.category) {
        query = query.eq('category', filter.category);
      }
      if (filter?.isPublic !== undefined) {
        query = query.eq('is_public', filter.isPublic);
      }
      if (filter?.isFavorite !== undefined) {
        query = query.eq('is_favorite', filter.isFavorite);
      }

      const { data, error } = await query;

      if (error) {
        console.error('변수 매핑 템플릿 목록 조회 오류:', error);
        return { success: false, error: error.message };
      }

      // 클라이언트 형식으로 변환
      const clientData = data?.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        tags: item.tags || [],
        variableMappings: item.variable_mappings || [],
        usageCount: item.usage_count || 0,
        lastUsedAt: item.last_used_at,
        isPublic: item.is_public || false,
        isFavorite: item.is_favorite || false,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })) || [];

      return { success: true, data: clientData };
    } catch (error) {
      console.error('변수 매핑 템플릿 목록 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 변수 매핑 템플릿 상세 조회
  async getVariableMappingTemplate(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('variable_mapping_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('변수 매핑 템플릿 조회 오류:', error);
        return { success: false, error: error.message };
      }

      // 응답 데이터를 클라이언트 형식으로 변환
      const clientData = {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        variableMappings: data.variable_mappings || [],
        usageCount: data.usage_count || 0,
        lastUsedAt: data.last_used_at,
        isPublic: data.is_public || false,
        isFavorite: data.is_favorite || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { success: true, data: clientData };
    } catch (error) {
      console.error('변수 매핑 템플릿 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 변수 매핑 템플릿 업데이트
  async updateVariableMappingTemplate(id: string, updates: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.variableMappings) updateData.variable_mappings = updates.variableMappings;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
      if (updates.isFavorite !== undefined) updateData.is_favorite = updates.isFavorite;
      if (updates.lastUsedAt) updateData.last_used_at = updates.lastUsedAt;

      const { data, error } = await client
        .from('variable_mapping_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('변수 매핑 템플릿 업데이트 오류:', error);
        return { success: false, error: error.message };
      }

      // 응답 데이터를 클라이언트 형식으로 변환
      const clientData = {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        variableMappings: data.variable_mappings || [],
        usageCount: data.usage_count || 0,
        lastUsedAt: data.last_used_at,
        isPublic: data.is_public || false,
        isFavorite: data.is_favorite || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { success: true, data: clientData };
    } catch (error) {
      console.error('변수 매핑 템플릿 업데이트 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 변수 매핑 템플릿 삭제
  async deleteVariableMappingTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { error } = await client
        .from('variable_mapping_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('변수 매핑 템플릿 삭제 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('변수 매핑 템플릿 삭제 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 변수 매핑 템플릿 사용 기록
  async recordVariableMappingTemplateUsage(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      // SQL 함수를 사용하여 usage_count 증가
      const { error } = await client.rpc('increment_usage_count', {
        table_name: 'variable_mapping_templates',
        record_id: id
      });

      if (error) {
        // RPC 함수가 없는 경우 대안 방법 사용
        console.warn('RPC 함수를 사용할 수 없어 대안 방법을 사용합니다:', error);
        
        // 현재 값을 가져와서 업데이트
        const { data: current, error: fetchError } = await client
          .from('variable_mapping_templates')
          .select('usage_count')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('변수 매핑 템플릿 사용 기록 오류:', fetchError);
          return { success: false, error: fetchError.message };
        }

        const { error: updateError } = await client
          .from('variable_mapping_templates')
          .update({
            usage_count: (current.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          console.error('변수 매핑 템플릿 사용 기록 오류:', updateError);
          return { success: false, error: updateError.message };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('변수 매핑 템플릿 사용 기록 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // =====================================================
  // 개별 변수 매핑 관리 메서드 (NEW)
  // =====================================================

  // 개별 변수 매핑 생성
  async createIndividualVariableMapping(mapping: any): Promise<any> {
    try {
      const client = this.getClient();

      console.log('🔧 개별 변수 매핑 생성 시도:', mapping);
      console.log('🔧 클라이언트 상태:', !!client);

      const insertData = {
        variable_name: mapping.variableName,
        display_name: mapping.displayName,
        source_type: mapping.sourceType,
        source_field: mapping.sourceField,
        selected_column: mapping.selectedColumn,
        key_column: mapping.keyColumn || '',
        default_value: mapping.defaultValue,
        formatter: mapping.formatter || 'text',
        category: mapping.category || 'general',
        tags: mapping.tags || [],
        is_public: mapping.isPublic || false,
        is_favorite: mapping.isFavorite || false,
        created_by: mapping.createdBy || 'system'
      };

      console.log('🔧 삽입할 데이터:', insertData);

      const { data, error } = await client
        .from('individual_variable_mappings')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('❌ 개별 변수 매핑 생성 Supabase 오류:', error);
        console.error('❌ 오류 코드:', error.code);
        console.error('❌ 오류 메시지:', error.message);
        console.error('❌ 오류 세부사항:', error.details);
        console.error('❌ 오류 힌트:', error.hint);
        throw new Error(`Supabase 오류: ${error.message} (코드: ${error.code})`);
      }

      console.log('✅ 개별 변수 매핑 생성 성공:', data);

      // 응답 데이터를 클라이언트 형식으로 변환
      return {
        id: data.id,
        variableName: data.variable_name,
        displayName: data.display_name,
        sourceType: data.source_type,
        sourceField: data.source_field,
        selectedColumn: data.selected_column,
        keyColumn: data.key_column,
        defaultValue: data.default_value,
        formatter: data.formatter,
        category: data.category,
        tags: data.tags,
        usageCount: data.usage_count,
        lastUsedAt: data.last_used_at,
        isPublic: data.is_public,
        isFavorite: data.is_favorite,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('❌ 개별 변수 매핑 생성 최종 실패:', error);
      console.error('❌ 오류 타입:', typeof error);
      console.error('❌ 오류 스택:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  // 개별 변수 매핑 목록 조회
  async getIndividualVariableMappings(filter?: any): Promise<any[]> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      console.log('🔍 개별 변수 매핑 목록 조회 시도, 필터:', filter);

      let query = client
        .from('individual_variable_mappings')
        .select('*')
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false });

      // 필터 적용
      if (filter?.category && filter.category !== 'all') {
        query = query.eq('category', filter.category);
      }
      if (filter?.isPublic !== undefined) {
        query = query.eq('is_public', filter.isPublic);
      }
      if (filter?.isFavorite !== undefined) {
        query = query.eq('is_favorite', filter.isFavorite);
      }
      if (filter?.search) {
        query = query.or(`variable_name.ilike.%${filter.search}%,display_name.ilike.%${filter.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('개별 변수 매핑 목록 조회 오류:', error);
        throw error;
      }

      console.log('✅ 개별 변수 매핑 목록 조회 성공:', data?.length || 0, '개');

      // 응답 데이터를 클라이언트 형식으로 변환
      return (data || []).map(item => ({
        id: item.id,
        variableName: item.variable_name,
        displayName: item.display_name,
        sourceType: item.source_type,
        sourceField: item.source_field,
        selectedColumn: item.selected_column,
        keyColumn: item.key_column,
        defaultValue: item.default_value,
        formatter: item.formatter,
        category: item.category,
        tags: item.tags,
        usageCount: item.usage_count,
        lastUsedAt: item.last_used_at,
        isPublic: item.is_public,
        isFavorite: item.is_favorite,
        createdBy: item.created_by,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    } catch (error) {
      console.error('개별 변수 매핑 목록 조회 실패:', error);
      throw error;
    }
  }

  // 특정 개별 변수 매핑 조회
  async getIndividualVariableMapping(variableName: string): Promise<any | null> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { data, error } = await client
        .from('individual_variable_mappings')
        .select('*')
        .eq('variable_name', variableName)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // 데이터 없음
        }
        console.error('개별 변수 매핑 조회 오류:', error);
        throw error;
      }

      // 응답 데이터를 클라이언트 형식으로 변환
      return {
        id: data.id,
        variableName: data.variable_name,
        displayName: data.display_name,
        sourceType: data.source_type,
        sourceField: data.source_field,
        selectedColumn: data.selected_column,
        keyColumn: data.key_column,
        defaultValue: data.default_value,
        formatter: data.formatter,
        category: data.category,
        tags: data.tags,
        usageCount: data.usage_count,
        lastUsedAt: data.last_used_at,
        isPublic: data.is_public,
        isFavorite: data.is_favorite,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('개별 변수 매핑 조회 실패:', error);
      throw error;
    }
  }

  // 개별 변수 매핑 업데이트
  async updateIndividualVariableMapping(id: string, updates: any): Promise<any | null> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const updateData: any = {};
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.sourceType !== undefined) updateData.source_type = updates.sourceType;
      if (updates.sourceField !== undefined) updateData.source_field = updates.sourceField;
      if (updates.selectedColumn !== undefined) updateData.selected_column = updates.selectedColumn;
      if (updates.keyColumn !== undefined) updateData.key_column = updates.keyColumn;
      if (updates.defaultValue !== undefined) updateData.default_value = updates.defaultValue;
      if (updates.formatter !== undefined) updateData.formatter = updates.formatter;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
      if (updates.isFavorite !== undefined) updateData.is_favorite = updates.isFavorite;

      const { data, error } = await client
        .from('individual_variable_mappings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('개별 변수 매핑 업데이트 오류:', error);
        throw error;
      }

      // 응답 데이터를 클라이언트 형식으로 변환
      return {
        id: data.id,
        variableName: data.variable_name,
        displayName: data.display_name,
        sourceType: data.source_type,
        sourceField: data.source_field,
        selectedColumn: data.selected_column,
        keyColumn: data.key_column,
        defaultValue: data.default_value,
        formatter: data.formatter,
        category: data.category,
        tags: data.tags,
        usageCount: data.usage_count,
        lastUsedAt: data.last_used_at,
        isPublic: data.is_public,
        isFavorite: data.is_favorite,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('개별 변수 매핑 업데이트 실패:', error);
      throw error;
    }
  }

  // 개별 변수 매핑 삭제
  async deleteIndividualVariableMapping(id: string): Promise<boolean> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      const { error } = await client
        .from('individual_variable_mappings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('개별 변수 매핑 삭제 오류:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('개별 변수 매핑 삭제 실패:', error);
      throw error;
    }
  }

  // 개별 변수 매핑 사용 기록
  async recordIndividualVariableMappingUsage(variableName: string): Promise<void> {
    try {
      await this.ensureTables();
      const client = this.getClient();

      // SQL 함수를 사용하여 usage_count 증가
      const { error } = await client.rpc('increment_variable_usage_count', {
        var_name: variableName
      });

      if (error) {
        // RPC 함수가 없는 경우 대안 방법 사용
        console.warn('RPC 함수를 사용할 수 없어 대안 방법을 사용합니다:', error);
        
        // 현재 값을 가져와서 업데이트
        const { data: current, error: fetchError } = await client
          .from('individual_variable_mappings')
          .select('usage_count')
          .eq('variable_name', variableName)
          .single();

        if (fetchError) {
          console.error('개별 변수 매핑 사용 기록 오류:', fetchError);
          throw fetchError;
        }

        const { error: updateError } = await client
          .from('individual_variable_mappings')
          .update({
            usage_count: (current.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('variable_name', variableName);

        if (updateError) {
          console.error('개별 변수 매핑 사용 기록 오류:', updateError);
          throw updateError;
        }
      }
    } catch (error) {
      console.error('개별 변수 매핑 사용 기록 실패:', error);
      throw error;
    }
  }

  // 🔥 스케줄 필드 동기화 처리
  private normalizeScheduleFields(workflow: any): any {
    // 메인 스케줄 설정 확인 (우선순위: schedule_config > schedule_settings)
    const mainSchedule = workflow.schedule_config || workflow.schedule_settings;
    
    if (mainSchedule) {
      // 1. 모든 스케줄 필드를 메인 스케줄로 동기화
      workflow.schedule_config = mainSchedule;
      workflow.schedule_settings = mainSchedule;
      
      // 2. variables 내부 scheduleSettings 동기화
      if (workflow.variables) {
        workflow.variables.scheduleSettings = mainSchedule;
      }
      
      // 3. message_config 내부 scheduleSettings 동기화
      if (workflow.message_config?.steps) {
        workflow.message_config.steps = workflow.message_config.steps.map((step: any) => {
          if (step.action) {
            return {
              ...step,
              action: {
                ...step.action,
                scheduleSettings: mainSchedule
              }
            };
          }
          return step;
        });
      }
      
      console.log('🔄 스케줄 필드 동기화 완료:', {
        workflowId: workflow.id,
        workflowName: workflow.name,
        scheduleTime: mainSchedule.recurringPattern?.time || mainSchedule.time,
        allFieldsSynced: true
      });
    }
    
    return workflow;
  }
}

// 싱글톤 인스턴스 생성
const supabaseWorkflowService = new SupabaseWorkflowService();

export default supabaseWorkflowService; 