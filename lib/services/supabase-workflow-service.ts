import { supabaseAdmin } from '@/lib/database/supabase-client';
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
  private async ensureTables() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client가 초기화되지 않았습니다.');
    }

    // 테이블 존재 확인 및 생성은 이미 supabase_hybrid_schema.sql에서 처리됨
    // 여기서는 연결만 확인
    const { data, error } = await (supabaseAdmin as SupabaseClient)
      .from('workflows')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      throw new Error('워크플로우 테이블이 존재하지 않습니다. 스키마를 먼저 실행해주세요.');
    }
  }

  // =====================================================
  // 워크플로우 관리 메서드
  // =====================================================

  // 워크플로우 생성
  async createWorkflow(workflow: Workflow): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();

      const { data, error } = await supabaseAdmin
        .from('workflows')
        .insert([{
          name: workflow.name,
          description: workflow.description,
          status: workflow.status || 'draft',
          trigger_type: workflow.triggerType,
          trigger_config: workflow.triggerConfig || {},
          target_config: workflow.targetConfig || {},
          message_config: workflow.messageConfig || {},
          variables: workflow.variables || {},
          schedule_config: workflow.scheduleConfig || {},
          created_by: workflow.createdBy || 'system'
        }])
        .select()
        .single();

      if (error) {
        console.error('워크플로우 생성 오류:', error);
        return { success: false, error: error.message };
      }

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

      const { data, error } = await supabaseAdmin
        .from('workflows')
        .select(`
          id, name, description, status, trigger_type,
          created_at, updated_at, last_run_at, next_run_at,
          statistics
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('워크플로우 목록 조회 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('워크플로우 목록 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 상세 조회
  async getWorkflow(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();

      const { data, error } = await supabaseAdmin
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('워크플로우 조회 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('워크플로우 조회 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }

  // 워크플로우 업데이트
  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status) updateData.status = updates.status;
      if (updates.triggerType) updateData.trigger_type = updates.triggerType;
      if (updates.triggerConfig) updateData.trigger_config = updates.triggerConfig;
      if (updates.targetConfig) updateData.target_config = updates.targetConfig;
      if (updates.messageConfig) updateData.message_config = updates.messageConfig;
      if (updates.variables) updateData.variables = updates.variables;
      if (updates.scheduleConfig) updateData.schedule_config = updates.scheduleConfig;

      const { data, error } = await supabaseAdmin
        .from('workflows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('워크플로우 업데이트 오류:', error);
        return { success: false, error: error.message };
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

      const { error } = await supabaseAdmin
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

  // 워크플로우 실행 통계 조회
  async getWorkflowStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      await this.ensureTables();

      // 전체 통계
      const { data: totalStats, error: totalError } = await supabaseAdmin
        .from('workflows')
        .select('status')
        .then(result => {
          if (result.error) return result;
          
          const stats = result.data?.reduce((acc: any, workflow: any) => {
            acc.total = (acc.total || 0) + 1;
            acc[workflow.status] = (acc[workflow.status] || 0) + 1;
            return acc;
          }, {}) || {};

          return { data: stats, error: null };
        });

      if (totalError) {
        return { success: false, error: totalError.message };
      }

      // 최근 실행 기록
      const { data: recentRuns, error: runsError } = await supabaseAdmin
        .from('workflow_runs')
        .select('status, started_at, success_count, failed_count')
        .order('started_at', { ascending: false })
        .limit(10);

      if (runsError) {
        return { success: false, error: runsError.message };
      }

      return {
        success: true,
        data: {
          totalStats,
          recentRuns: recentRuns || []
        }
      };
    } catch (error) {
      console.error('워크플로우 통계 조회 실패:', error);
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

      const { data, error } = await supabaseAdmin
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

      const { data, error } = await supabaseAdmin
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

      const { data, error } = await supabaseAdmin
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

      const updateData: any = {};
      if (updates.display_name) updateData.display_name = updates.display_name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.query_sql) updateData.query_sql = updates.query_sql;
      if (updates.variables) updateData.variables = updates.variables;
      if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
      if (updates.category) updateData.category = updates.category;

      const { data, error } = await supabaseAdmin
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

      const { error } = await supabaseAdmin
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

      const { data, error } = await supabaseAdmin
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

      // 전체 쿼리 통계
      const { data: totalStats, error: totalError } = await supabaseAdmin
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
      const { data: recentLogs, error: logsError } = await supabaseAdmin
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

      const { data, error } = await supabaseAdmin
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

      let query = supabaseAdmin
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

      const { data, error } = await supabaseAdmin
        .from('variable_mapping_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('변수 매핑 템플릿 조회 오류:', error);
        return { success: false, error: error.message };
      }

      // 클라이언트 형식으로 변환
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

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.variableMappings) updateData.variable_mappings = updates.variableMappings;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
      if (updates.isFavorite !== undefined) updateData.is_favorite = updates.isFavorite;
      if (updates.lastUsedAt) updateData.last_used_at = updates.lastUsedAt;

      const { data, error } = await supabaseAdmin
        .from('variable_mapping_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('변수 매핑 템플릿 업데이트 오류:', error);
        return { success: false, error: error.message };
      }

      // 클라이언트 형식으로 변환
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

      const { error } = await supabaseAdmin
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

      const { error } = await supabaseAdmin
        .from('variable_mapping_templates')
        .update({
          usage_count: supabaseAdmin.raw('usage_count + 1'),
          last_used_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('변수 매핑 템플릿 사용 기록 오류:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('변수 매핑 템플릿 사용 기록 실패:', error);
      return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
    }
  }
}

// 싱글톤 인스턴스 생성
const supabaseWorkflowService = new SupabaseWorkflowService();

export default supabaseWorkflowService; 