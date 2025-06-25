import type { 
  VariableMappingTemplate, 
  VariableMapping, 
  MappingSuggestion,
  MappingTemplateFilter 
} from '@/lib/types/workflow';
import { supabase } from '../database/supabase-client';

/**
 * 변수 매핑 템플릿 관리 서비스 (Supabase 전용)
 */
export class MappingTemplateService {
  /**
   * 모든 매핑 템플릿 조회 (Supabase 전용)
   */
  static async getAllTemplates(): Promise<VariableMappingTemplate[]> {
    try {
      console.log('📊 Supabase에서 변수 매핑 템플릿 조회 중...');
      
      const { data, error } = await supabase
        .from('variable_mapping_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase 조회 실패:', error);
        throw new Error(`변수 매핑 템플릿 조회 실패: ${error.message}`);
      }

      const templates = data || [];
      console.log(`📊 Supabase에서 ${templates.length}개 변수 매핑 템플릿 조회 성공`);
      
      return templates;
    } catch (error) {
      console.error('❌ 변수 매핑 템플릿 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 템플릿 조회 (Supabase 전용)
   */
  static async getTemplateById(id: string): Promise<VariableMappingTemplate | null> {
    try {
      console.log(`📄 Supabase에서 템플릿 ${id} 조회 중...`);
      
      const { data, error } = await supabase
        .from('variable_mapping_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`📄 템플릿 ${id}를 찾을 수 없음`);
          return null;
        }
        console.error('❌ Supabase 조회 실패:', error);
        throw new Error(`템플릿 조회 실패: ${error.message}`);
      }

      console.log(`📄 Supabase에서 템플릿 ${id} 조회 성공`);
      return data;
    } catch (error) {
      console.error('❌ 템플릿 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 새 템플릿 저장 (Supabase 전용)
   */
  static async saveTemplate(template: Omit<VariableMappingTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<VariableMappingTemplate> {
    try {
      console.log('💾 Supabase에 새 매핑 템플릿 저장 중...', template.name);
      
      const newTemplate: VariableMappingTemplate = {
        ...template,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('variable_mapping_templates')
        .insert([newTemplate])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 저장 실패:', error);
        throw new Error(`템플릿 저장 실패: ${error.message}`);
      }

      console.log(`💾 Supabase에 템플릿 저장 성공: ${data.id}`);
      return data;
    } catch (error) {
      console.error('❌ 템플릿 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 템플릿 업데이트 (Supabase 전용)
   */
  static async updateTemplate(id: string, updates: Partial<VariableMappingTemplate>): Promise<VariableMappingTemplate> {
    try {
      console.log(`🔄 Supabase에서 템플릿 ${id} 업데이트 중...`);
      
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('variable_mapping_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 업데이트 실패:', error);
        throw new Error(`템플릿 업데이트 실패: ${error.message}`);
      }

      console.log(`🔄 Supabase에서 템플릿 ${id} 업데이트 성공`);
      return data;
    } catch (error) {
      console.error('❌ 템플릿 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 템플릿 삭제 (Supabase 전용)
   */
  static async deleteTemplate(id: string): Promise<void> {
    try {
      console.log(`🗑️ Supabase에서 템플릿 ${id} 삭제 중...`);
      
      const { error } = await supabase
        .from('variable_mapping_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase 삭제 실패:', error);
        throw new Error(`템플릿 삭제 실패: ${error.message}`);
      }

      console.log(`🗑️ Supabase에서 템플릿 ${id} 삭제 성공`);
    } catch (error) {
      console.error('❌ 템플릿 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 템플릿 사용 기록 (Supabase 전용)
   */
  static async recordUsage(id: string): Promise<void> {
    try {
      console.log(`📈 템플릿 ${id} 사용 기록 중...`);
      
      // 먼저 현재 사용 횟수를 조회
      const { data: currentData, error: fetchError } = await supabase
        .from('variable_mapping_templates')
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
        .from('variable_mapping_templates')
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

      console.log(`📈 템플릿 ${id} 사용 기록 성공`);
    } catch (error) {
      console.error('❌ 사용 기록 실패:', error);
      throw error;
    }
  }

  // =====================================================
  // 기존 메서드들 (호환성 유지)
  // =====================================================

  static generateSuggestions(templateVariables: string[], queryResults: any[]): MappingSuggestion[] {
    const suggestions: MappingSuggestion[] = [];
    
    if (!queryResults || queryResults.length === 0) {
      return suggestions;
    }

    const sampleRow = queryResults[0];
    const availableColumns = Object.keys(sampleRow);

    templateVariables.forEach(variable => {
      const cleanVariable = variable.replace(/^#{|}$/g, '');
      const suggestedMappings: MappingSuggestion['suggestedMappings'] = [];
      
      // 정확한 매칭
      const exactMatch = availableColumns.find(col => 
        col.toLowerCase() === cleanVariable.toLowerCase()
      );
      
      if (exactMatch) {
        suggestedMappings.push({
          template: {
            id: 'auto-generated',
            name: '자동 생성 매핑',
            description: '정확한 이름 매칭',
            category: 'auto',
            tags: ['auto'],
            variableMappings: [],
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false
          },
          mapping: {
            templateVariable: variable,
            sourceField: exactMatch,
            sourceType: 'field',
            defaultValue: '',
            formatter: 'text'
          },
          confidence: 1.0,
          reason: '정확한 이름 매칭'
        });
      }

      // 부분 매칭
      const partialMatches = availableColumns.filter(col =>
        col.toLowerCase().includes(cleanVariable.toLowerCase()) ||
        cleanVariable.toLowerCase().includes(col.toLowerCase())
      );

      partialMatches.forEach(col => {
        suggestedMappings.push({
          template: {
            id: 'auto-generated',
            name: '자동 생성 매핑',
            description: '부분 이름 매칭',
            category: 'auto',
            tags: ['auto'],
            variableMappings: [],
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false
          },
          mapping: {
            templateVariable: variable,
            sourceField: col,
            sourceType: 'field',
            defaultValue: '',
            formatter: 'text'
          },
          confidence: 0.7,
          reason: '부분 이름 매칭'
        });
      });

      // 의미적 매칭
      const semanticMatches = this.getSemanticMatches(cleanVariable, availableColumns);
      semanticMatches.forEach(match => {
        suggestedMappings.push({
          template: {
            id: 'auto-generated',
            name: '자동 생성 매핑',
            description: match.reason,
            category: 'auto',
            tags: ['auto'],
            variableMappings: [],
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false
          },
          mapping: {
            templateVariable: variable,
            sourceField: match.field,
            sourceType: 'field',
            defaultValue: '',
            formatter: 'text'
          },
          confidence: match.confidence,
          reason: match.reason
        });
      });

      if (suggestedMappings.length > 0) {
        suggestions.push({
          templateVariable: variable,
          suggestedMappings: suggestedMappings.slice(0, 3) // 최대 3개까지만
        });
      }
    });

    return suggestions;
  }

  private static getSemanticMatches(variable: string, columns: string[]): Array<{field: string, confidence: number, reason: string}> {
    const semanticMap: Record<string, string[]> = {
      'name': ['이름', 'name', 'user_name', 'username', 'full_name'],
      'phone': ['전화번호', 'phone', 'mobile', 'tel', 'phone_number'],
      'email': ['이메일', 'email', 'mail', 'email_address'],
      'company': ['회사', 'company', 'corp', 'organization'],
      'amount': ['금액', 'amount', 'price', 'cost', 'fee'],
      'date': ['날짜', 'date', 'created_at', 'updated_at', 'time'],
      'status': ['상태', 'status', 'state', 'condition']
    };

    const matches: Array<{field: string, confidence: number, reason: string}> = [];
    
    Object.entries(semanticMap).forEach(([key, synonyms]) => {
      if (synonyms.some(syn => variable.toLowerCase().includes(syn.toLowerCase()))) {
        const matchingColumns = columns.filter(col =>
          synonyms.some(syn => col.toLowerCase().includes(syn.toLowerCase()))
        );
        
        matchingColumns.forEach(col => {
          matches.push({
            field: col,
            confidence: 0.6,
            reason: `의미적 매칭 (${key})`
          });
        });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  static getPopularTemplates(limit: number = 5): Promise<VariableMappingTemplate[]> {
    return this.getAllTemplates().then(templates => 
      templates
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, limit)
    );
  }

  static getRecentTemplates(limit: number = 5): Promise<VariableMappingTemplate[]> {
    return this.getAllTemplates().then(templates =>
      templates
        .filter(t => t.lastUsedAt)
        .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
        .slice(0, limit)
    );
  }

  static getFavoriteTemplates(): Promise<VariableMappingTemplate[]> {
    return this.getAllTemplates().then(templates => templates.filter(t => t.isFavorite));
  }

  static getTemplatesByCategory(category: string): Promise<VariableMappingTemplate[]> {
    return this.getAllTemplates().then(templates => templates.filter(t => t.category === category));
  }

  static searchTemplates(query: string): Promise<VariableMappingTemplate[]> {
    return this.getAllTemplates().then(templates =>
      templates.filter(template =>
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        (template.description && template.description.toLowerCase().includes(query.toLowerCase())) ||
        template.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
    );
  }

  static async toggleFavorite(id: string): Promise<VariableMappingTemplate | null> {
    const template = await this.getTemplateById(id);
    if (!template) return null;

    return this.updateTemplate(id, {
      isFavorite: !template.isFavorite
    });
  }

  static async duplicateTemplate(id: string, newName?: string): Promise<VariableMappingTemplate | null> {
    const original = await this.getTemplateById(id);
    if (!original) return null;

    const duplicate = {
      ...original,
      name: newName || `${original.name} (복사본)`,
      isFavorite: false,
      usageCount: 0,
      lastUsedAt: undefined
    };

    // id, createdAt, updatedAt 제거
    const { id: _, createdAt: __, updatedAt: ___, ...templateData } = duplicate;
    
    return this.saveTemplate(templateData);
  }
} 