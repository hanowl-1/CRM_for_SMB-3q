import { supabase } from '../database/supabase-client';

export interface MappingHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  targetGroupId: string;
  targetGroupName: string;
  templateId: string;
  templateName: string;
  fieldMappings: Array<{
    templateVariable: string;
    targetField: string;
    formatter?: string;
  }>;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 매핑 히스토리 관리 서비스 (Supabase 전용)
 */
export class MappingHistoryService {
  /**
   * 모든 매핑 히스토리 조회
   */
  static async getAllHistory(): Promise<MappingHistoryEntry[]> {
    try {
      console.log('📊 Supabase에서 매핑 히스토리 조회 중...');
      
      const { data, error } = await supabase
        .from('mapping_history')
        .select('*')
        .order('last_used_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase 조회 실패:', error);
        throw new Error(`매핑 히스토리 조회 실패: ${error.message}`);
      }

      const history = data || [];
      console.log(`📊 Supabase에서 ${history.length}개 매핑 히스토리 조회 성공`);
      
      return history;
    } catch (error) {
      console.error('❌ 매핑 히스토리 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 워크플로우의 매핑 히스토리 조회
   */
  static async getHistoryByWorkflow(workflowId: string): Promise<MappingHistoryEntry[]> {
    try {
      console.log(`📄 워크플로우 ${workflowId}의 매핑 히스토리 조회 중...`);
      
      const { data, error } = await supabase
        .from('mapping_history')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('last_used_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase 조회 실패:', error);
        throw new Error(`워크플로우 매핑 히스토리 조회 실패: ${error.message}`);
      }

      console.log(`📄 워크플로우 ${workflowId}의 매핑 히스토리 ${data.length}개 조회 성공`);
      return data || [];
    } catch (error) {
      console.error('❌ 워크플로우 매핑 히스토리 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 히스토리 저장
   */
  static async saveHistory(entry: Omit<MappingHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MappingHistoryEntry> {
    try {
      console.log('💾 Supabase에 매핑 히스토리 저장 중...', entry.workflowName);
      
      const newEntry: MappingHistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('mapping_history')
        .insert([newEntry])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 저장 실패:', error);
        throw new Error(`매핑 히스토리 저장 실패: ${error.message}`);
      }

      console.log(`💾 Supabase에 매핑 히스토리 저장 성공: ${data.id}`);
      return data;
    } catch (error) {
      console.error('❌ 매핑 히스토리 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 히스토리 사용 기록 (사용 횟수 증가)
   */
  static async recordUsage(id: string): Promise<void> {
    try {
      console.log(`📈 매핑 히스토리 ${id} 사용 기록 중...`);
      
      // 먼저 현재 사용 횟수를 조회
      const { data: currentData, error: fetchError } = await supabase
        .from('mapping_history')
        .select('usage_count')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ 현재 사용 횟수 조회 실패:', fetchError);
        throw new Error(`사용 기록 실패: ${fetchError.message}`);
      }

      const currentUsageCount = currentData?.usage_count || 0;

      // 사용 횟수 증가 및 마지막 사용 시간 업데이트
      const { error } = await supabase
        .from('mapping_history')
        .update({
          usage_count: currentUsageCount + 1,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase 사용 기록 실패:', error);
        throw new Error(`사용 기록 실패: ${error.message}`);
      }

      console.log(`📈 매핑 히스토리 ${id} 사용 기록 성공`);
    } catch (error) {
      console.error('❌ 사용 기록 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 히스토리 삭제
   */
  static async deleteHistory(id: string): Promise<void> {
    try {
      console.log(`🗑️ Supabase에서 매핑 히스토리 ${id} 삭제 중...`);
      
      const { error } = await supabase
        .from('mapping_history')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase 삭제 실패:', error);
        throw new Error(`매핑 히스토리 삭제 실패: ${error.message}`);
      }

      console.log(`🗑️ Supabase에서 매핑 히스토리 ${id} 삭제 성공`);
    } catch (error) {
      console.error('❌ 매핑 히스토리 삭제 실패:', error);
      throw error;
    }
  }

  // 편의 메서드들
  static async getRecentHistory(limit: number = 10): Promise<MappingHistoryEntry[]> {
    const history = await this.getAllHistory();
    return history
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
      .slice(0, limit);
  }

  static async getPopularHistory(limit: number = 10): Promise<MappingHistoryEntry[]> {
    const history = await this.getAllHistory();
    return history
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  static async searchHistory(query: string): Promise<MappingHistoryEntry[]> {
    const history = await this.getAllHistory();
    return history.filter(entry =>
      entry.workflowName.toLowerCase().includes(query.toLowerCase()) ||
      entry.targetGroupName.toLowerCase().includes(query.toLowerCase()) ||
      entry.templateName.toLowerCase().includes(query.toLowerCase())
    );
  }
} 