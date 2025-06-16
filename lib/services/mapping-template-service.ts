import type { 
  VariableMappingTemplate, 
  VariableMapping, 
  MappingSuggestion,
  MappingTemplateFilter 
} from '@/lib/types/workflow';
import supabaseWorkflowService from './supabase-workflow-service';

export class MappingTemplateService {
  private static readonly STORAGE_KEY = 'variable_mapping_templates';
  // TODO: Supabase 연동 시 사용할 테이블명
  private static readonly TABLE_NAME = 'variable_mapping_templates';

  /**
   * 모든 매핑 템플릿 조회 (Supabase 우선, localStorage 백업)
   */
  static async getTemplates(filter?: MappingTemplateFilter): Promise<VariableMappingTemplate[]> {
    try {
      // 1. Supabase에서 템플릿 조회 시도
      const supabaseResult = await supabaseWorkflowService.getVariableMappingTemplates(filter);
      
      if (supabaseResult.success && supabaseResult.data) {
        console.log(`📊 Supabase에서 ${supabaseResult.data.length}개 변수 매핑 템플릿 조회 성공`);
        return supabaseResult.data;
      }
      
      console.warn('⚠️ Supabase 조회 실패, localStorage 백업 사용:', supabaseResult.error);
    } catch (error) {
      console.error('❌ Supabase 연결 오류, localStorage 백업 사용:', error);
    }

    // 2. localStorage 백업 사용
    const templates = this.loadFromStorage();
    let filtered = templates;

    // 필터링
    if (filter) {
      if (filter.category) {
        filtered = filtered.filter(t => t.category === filter.category);
      }
      if (filter.tags && filter.tags.length > 0) {
        filtered = filtered.filter(t => 
          filter.tags!.some(tag => t.tags.includes(tag))
        );
      }
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        filtered = filtered.filter(t => 
          t.name.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.tags.some(tag => tag.toLowerCase().includes(term))
        );
      }
      if (filter.isPublic !== undefined) {
        filtered = filtered.filter(t => t.isPublic === filter.isPublic);
      }
      if (filter.isFavorite !== undefined) {
        filtered = filtered.filter(t => t.isFavorite === filter.isFavorite);
      }
    }

    console.log(`📊 localStorage에서 ${filtered.length}개 변수 매핑 템플릿 조회`);
    return filtered;
  }

  /**
   * 특정 템플릿 조회
   */
  static async getTemplate(id: string): Promise<VariableMappingTemplate | null> {
    try {
      // 1. Supabase에서 조회 시도
      const supabaseResult = await supabaseWorkflowService.getVariableMappingTemplate(id);
      
      if (supabaseResult.success && supabaseResult.data) {
        console.log(`📄 Supabase에서 템플릿 ${id} 조회 성공`);
        return supabaseResult.data;
      }
      
      console.warn('⚠️ Supabase 조회 실패, localStorage 백업 사용:', supabaseResult.error);
    } catch (error) {
      console.error('❌ Supabase 연결 오류, localStorage 백업 사용:', error);
    }

    // 2. localStorage 백업 사용
    const templates = this.loadFromStorage();
    const template = templates.find(t => t.id === id);
    
    if (template) {
      console.log(`📄 localStorage에서 템플릿 ${id} 조회 성공`);
    }
    
    return template || null;
  }

  /**
   * 새 템플릿 저장 (Supabase 우선, localStorage 백업)
   */
  static async saveTemplate(template: Omit<VariableMappingTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<VariableMappingTemplate> {
    const newTemplate: VariableMappingTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    try {
      // 1. Supabase에 저장 시도
      const supabaseResult = await supabaseWorkflowService.createVariableMappingTemplate(newTemplate);
      
      if (supabaseResult.success && supabaseResult.data) {
        console.log(`💾 Supabase에 템플릿 저장 성공:`, supabaseResult.data.id);
        
        // localStorage에도 백업 저장
        this.saveToStorage(newTemplate);
        
        return supabaseResult.data;
      }
      
      console.warn('⚠️ Supabase 저장 실패, localStorage만 사용:', supabaseResult.error);
    } catch (error) {
      console.error('❌ Supabase 연결 오류, localStorage만 사용:', error);
    }

    // 2. localStorage에만 저장
    this.saveToStorage(newTemplate);
    console.log(`💾 localStorage에 템플릿 저장: ${newTemplate.id}`);
    
    return newTemplate;
  }

  /**
   * 템플릿 업데이트 (Supabase 우선, localStorage 백업)
   */
  static async updateTemplate(id: string, updates: Partial<VariableMappingTemplate>): Promise<VariableMappingTemplate | null> {
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Supabase에서 업데이트 시도
      const supabaseResult = await supabaseWorkflowService.updateVariableMappingTemplate(id, updateData);
      
      if (supabaseResult.success && supabaseResult.data) {
        console.log(`🔄 Supabase에서 템플릿 ${id} 업데이트 성공`);
        
        // localStorage에도 백업 업데이트
        this.updateInStorage(id, updateData);
        
        return supabaseResult.data;
      }
      
      console.warn('⚠️ Supabase 업데이트 실패, localStorage만 사용:', supabaseResult.error);
    } catch (error) {
      console.error('❌ Supabase 연결 오류, localStorage만 사용:', error);
    }

    // 2. localStorage에서만 업데이트
    const updated = this.updateInStorage(id, updateData);
    if (updated) {
      console.log(`🔄 localStorage에서 템플릿 ${id} 업데이트 성공`);
    }
    
    return updated;
  }

  /**
   * 템플릿 삭제 (Supabase 우선, localStorage 백업)
   */
  static async deleteTemplate(id: string): Promise<boolean> {
    try {
      // 1. Supabase에서 삭제 시도
      const supabaseResult = await supabaseWorkflowService.deleteVariableMappingTemplate(id);
      
      if (supabaseResult.success) {
        console.log(`🗑️ Supabase에서 템플릿 ${id} 삭제 성공`);
        
        // localStorage에서도 삭제
        this.deleteFromStorage(id);
        
        return true;
      }
      
      console.warn('⚠️ Supabase 삭제 실패, localStorage만 사용:', supabaseResult.error);
    } catch (error) {
      console.error('❌ Supabase 연결 오류, localStorage만 사용:', error);
    }

    // 2. localStorage에서만 삭제
    const deleted = this.deleteFromStorage(id);
    if (deleted) {
      console.log(`🗑️ localStorage에서 템플릿 ${id} 삭제 성공`);
    }
    
    return deleted;
  }

  /**
   * 템플릿 사용 기록 (Supabase 우선, localStorage 백업)
   */
  static async recordUsage(id: string): Promise<void> {
    try {
      // 1. Supabase에서 사용 기록 시도
      const supabaseResult = await supabaseWorkflowService.recordVariableMappingTemplateUsage(id);
      
      if (supabaseResult.success) {
        console.log(`📈 Supabase에서 템플릿 ${id} 사용 기록 성공`);
        
        // localStorage에도 백업 기록
        this.recordUsageInStorage(id);
        
        return;
      }
      
      console.warn('⚠️ Supabase 사용 기록 실패, localStorage만 사용:', supabaseResult.error);
    } catch (error) {
      console.error('❌ Supabase 연결 오류, localStorage만 사용:', error);
    }

    // 2. localStorage에서만 기록
    this.recordUsageInStorage(id);
    console.log(`📈 localStorage에서 템플릿 ${id} 사용 기록`);
  }

  // =====================================================
  // localStorage 백업 메서드들 (기존 유지)
  // =====================================================

  private static loadFromStorage(): VariableMappingTemplate[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('localStorage 로드 실패:', error);
      return [];
    }
  }

  private static saveToStorage(template: VariableMappingTemplate): void {
    try {
      const templates = this.loadFromStorage();
      const existingIndex = templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        templates[existingIndex] = template;
      } else {
        templates.push(template);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('localStorage 저장 실패:', error);
    }
  }

  private static updateInStorage(id: string, updates: Partial<VariableMappingTemplate>): VariableMappingTemplate | null {
    try {
      const templates = this.loadFromStorage();
      const index = templates.findIndex(t => t.id === id);
      
      if (index >= 0) {
        templates[index] = { ...templates[index], ...updates };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
        return templates[index];
      }
      
      return null;
    } catch (error) {
      console.error('localStorage 업데이트 실패:', error);
      return null;
    }
  }

  private static deleteFromStorage(id: string): boolean {
    try {
      const templates = this.loadFromStorage();
      const filteredTemplates = templates.filter(t => t.id !== id);
      
      if (filteredTemplates.length < templates.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredTemplates));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('localStorage 삭제 실패:', error);
      return false;
    }
  }

  private static recordUsageInStorage(id: string): void {
    try {
      const templates = this.loadFromStorage();
      const index = templates.findIndex(t => t.id === id);
      
      if (index >= 0) {
        templates[index].usageCount = (templates[index].usageCount || 0) + 1;
        templates[index].lastUsedAt = new Date().toISOString();
        templates[index].updatedAt = new Date().toISOString();
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
      }
    } catch (error) {
      console.error('localStorage 사용 기록 실패:', error);
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
    return this.getTemplates().then(templates => 
      templates
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, limit)
    );
  }

  static getRecentTemplates(limit: number = 5): Promise<VariableMappingTemplate[]> {
    return this.getTemplates().then(templates =>
      templates
        .filter(t => t.lastUsedAt)
        .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())
        .slice(0, limit)
    );
  }

  static getFavoriteTemplates(): Promise<VariableMappingTemplate[]> {
    return this.getTemplates({ isFavorite: true });
  }

  static getTemplatesByCategory(category: string): Promise<VariableMappingTemplate[]> {
    return this.getTemplates({ category });
  }

  static searchTemplates(query: string): Promise<VariableMappingTemplate[]> {
    return this.getTemplates().then(templates =>
      templates.filter(template =>
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        (template.description && template.description.toLowerCase().includes(query.toLowerCase())) ||
        template.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
    );
  }

  static async toggleFavorite(id: string): Promise<VariableMappingTemplate | null> {
    const template = await this.getTemplate(id);
    if (!template) return null;

    return this.updateTemplate(id, {
      isFavorite: !template.isFavorite
    });
  }

  static async duplicateTemplate(id: string, newName?: string): Promise<VariableMappingTemplate | null> {
    const original = await this.getTemplate(id);
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