import { supabase } from '../database/supabase-client';

export interface VariableQueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  queryConfig: {
    sql: string;
    parameters: string[];
    expectedColumns: string[];
    description: string;
  };
  usageCount: number;
  lastUsedAt?: string;
  isPublic: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 변수 쿼리 템플릿 관리 서비스 (Supabase 전용)
 */
export class VariableQueryTemplateService {
  /**
   * 모든 쿼리 템플릿 조회
   */
  static async getAllTemplates(): Promise<VariableQueryTemplate[]> {
    try {
      console.log('📊 Supabase에서 변수 쿼리 템플릿 조회 중...');
      
      const { data, error } = await supabase
        .from('variable_query_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase 조회 실패:', error);
        throw new Error(`변수 쿼리 템플릿 조회 실패: ${error.message}`);
      }

      const templates = data || [];
      console.log(`📊 Supabase에서 ${templates.length}개 변수 쿼리 템플릿 조회 성공`);
      
      return templates;
    } catch (error) {
      console.error('❌ 변수 쿼리 템플릿 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 템플릿 조회
   */
  static async getTemplateById(id: string): Promise<VariableQueryTemplate | null> {
    try {
      console.log(`📄 Supabase에서 쿼리 템플릿 ${id} 조회 중...`);
      
      const { data, error } = await supabase
        .from('variable_query_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`📄 쿼리 템플릿 ${id}를 찾을 수 없음`);
          return null;
        }
        console.error('❌ Supabase 조회 실패:', error);
        throw new Error(`쿼리 템플릿 조회 실패: ${error.message}`);
      }

      console.log(`📄 Supabase에서 쿼리 템플릿 ${id} 조회 성공`);
      return data;
    } catch (error) {
      console.error('❌ 쿼리 템플릿 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 새 템플릿 저장
   */
  static async saveTemplate(template: Omit<VariableQueryTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<VariableQueryTemplate> {
    try {
      console.log('💾 Supabase에 새 쿼리 템플릿 저장 중...', template.name);
      
      const newTemplate: VariableQueryTemplate = {
        ...template,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('variable_query_templates')
        .insert([newTemplate])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 저장 실패:', error);
        throw new Error(`쿼리 템플릿 저장 실패: ${error.message}`);
      }

      console.log(`💾 Supabase에 쿼리 템플릿 저장 성공: ${data.id}`);
      return data;
    } catch (error) {
      console.error('❌ 쿼리 템플릿 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 템플릿 업데이트
   */
  static async updateTemplate(id: string, updates: Partial<VariableQueryTemplate>): Promise<VariableQueryTemplate> {
    try {
      console.log(`🔄 Supabase에서 쿼리 템플릿 ${id} 업데이트 중...`);
      
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('variable_query_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 업데이트 실패:', error);
        throw new Error(`쿼리 템플릿 업데이트 실패: ${error.message}`);
      }

      console.log(`🔄 Supabase에서 쿼리 템플릿 ${id} 업데이트 성공`);
      return data;
    } catch (error) {
      console.error('❌ 쿼리 템플릿 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 템플릿 삭제
   */
  static async deleteTemplate(id: string): Promise<void> {
    try {
      console.log(`🗑️ Supabase에서 쿼리 템플릿 ${id} 삭제 중...`);
      
      const { error } = await supabase
        .from('variable_query_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase 삭제 실패:', error);
        throw new Error(`쿼리 템플릿 삭제 실패: ${error.message}`);
      }

      console.log(`🗑️ Supabase에서 쿼리 템플릿 ${id} 삭제 성공`);
    } catch (error) {
      console.error('❌ 쿼리 템플릿 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 템플릿 사용 기록
   */
  static async recordUsage(id: string): Promise<void> {
    try {
      console.log(`📈 쿼리 템플릿 ${id} 사용 기록 중...`);
      
      // 먼저 현재 사용 횟수를 조회
      const { data: currentData, error: fetchError } = await supabase
        .from('variable_query_templates')
        .select('usageCount')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('❌ 현재 사용 횟수 조회 실패:', fetchError);
        throw new Error(`사용 기록 실패: ${fetchError.message}`);
      }

      const currentUsageCount = currentData?.usageCount || 0;

      // 사용 횟수 증가 및 마지막 사용 시간 업데이트
      const { error } = await supabase
        .from('variable_query_templates')
        .update({
          usageCount: currentUsageCount + 1,
          lastUsedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase 사용 기록 실패:', error);
        throw new Error(`사용 기록 실패: ${error.message}`);
      }

      console.log(`📈 쿼리 템플릿 ${id} 사용 기록 성공`);
    } catch (error) {
      console.error('❌ 사용 기록 실패:', error);
      throw error;
    }
  }

  // 편의 메서드들
  static async getPopularTemplates(limit: number = 5): Promise<VariableQueryTemplate[]> {
    const templates = await this.getAllTemplates();
    return templates
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  static async getRecentTemplates(limit: number = 5): Promise<VariableQueryTemplate[]> {
    const templates = await this.getAllTemplates();
    return templates
      .filter(t => t.lastUsedAt)
      .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
      .slice(0, limit);
  }

  static async getFavoriteTemplates(): Promise<VariableQueryTemplate[]> {
    const templates = await this.getAllTemplates();
    return templates.filter(t => t.isFavorite);
  }

  static async getTemplatesByCategory(category: string): Promise<VariableQueryTemplate[]> {
    const templates = await this.getAllTemplates();
    return templates.filter(t => t.category === category);
  }

  static async searchTemplates(query: string): Promise<VariableQueryTemplate[]> {
    const templates = await this.getAllTemplates();
    return templates.filter(template =>
      template.name.toLowerCase().includes(query.toLowerCase()) ||
      template.description.toLowerCase().includes(query.toLowerCase()) ||
      template.queryConfig.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  static async toggleFavorite(id: string): Promise<VariableQueryTemplate | null> {
    const template = await this.getTemplateById(id);
    if (!template) return null;

    return this.updateTemplate(id, { isFavorite: !template.isFavorite });
  }

  static async duplicateTemplate(id: string, newName?: string): Promise<VariableQueryTemplate | null> {
    const original = await this.getTemplateById(id);
    if (!original) return null;

    const duplicate = {
      ...original,
      name: newName || `${original.name} (복사본)`,
      usageCount: 0,
      lastUsedAt: undefined
    };

    // id, createdAt, updatedAt 제외
    const { id: _, createdAt: __, updatedAt: ___, ...templateData } = duplicate;
    return this.saveTemplate(templateData);
  }
} 