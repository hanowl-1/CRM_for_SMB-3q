import type { 
  VariableMappingTemplate, 
  VariableMapping, 
  MappingSuggestion,
  MappingTemplateFilter 
} from '@/lib/types/workflow';

export class MappingTemplateService {
  private static readonly STORAGE_KEY = 'variable_mapping_templates';

  /**
   * 모든 매핑 템플릿 조회
   */
  static getTemplates(filter?: MappingTemplateFilter): VariableMappingTemplate[] {
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

    // 정렬
    if (filter?.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[filter.sortBy!];
        const bVal = b[filter.sortBy!];
        const order = filter.sortOrder === 'desc' ? -1 : 1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * order;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * order;
        }
        return 0;
      });
    }

    return filtered;
  }

  /**
   * 특정 템플릿 조회
   */
  static getTemplate(id: string): VariableMappingTemplate | null {
    const templates = this.loadFromStorage();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * 템플릿 저장
   */
  static saveTemplate(template: Omit<VariableMappingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): VariableMappingTemplate {
    const templates = this.loadFromStorage();
    const now = new Date().toISOString();
    
    const newTemplate: VariableMappingTemplate = {
      ...template,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    };

    templates.push(newTemplate);
    this.saveToStorage(templates);
    
    return newTemplate;
  }

  /**
   * 템플릿 업데이트
   */
  static updateTemplate(id: string, updates: Partial<VariableMappingTemplate>): VariableMappingTemplate | null {
    const templates = this.loadFromStorage();
    const index = templates.findIndex(t => t.id === id);
    
    if (index === -1) return null;
    
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.saveToStorage(templates);
    return templates[index];
  }

  /**
   * 템플릿 삭제
   */
  static deleteTemplate(id: string): boolean {
    const templates = this.loadFromStorage();
    const filtered = templates.filter(t => t.id !== id);
    
    if (filtered.length === templates.length) return false;
    
    this.saveToStorage(filtered);
    return true;
  }

  /**
   * 템플릿 사용 기록
   */
  static recordUsage(id: string): void {
    const templates = this.loadFromStorage();
    const template = templates.find(t => t.id === id);
    
    if (template) {
      template.usageCount++;
      template.lastUsedAt = new Date().toISOString();
      this.saveToStorage(templates);
    }
  }

  /**
   * 즐겨찾기 토글
   */
  static toggleFavorite(id: string): boolean {
    const template = this.getTemplate(id);
    if (!template) return false;
    
    const newFavoriteStatus = !template.isFavorite;
    this.updateTemplate(id, { isFavorite: newFavoriteStatus });
    return newFavoriteStatus;
  }

  /**
   * 자동 매핑 제안
   */
  static getSuggestions(templateVariables: string[]): MappingSuggestion[] {
    const templates = this.loadFromStorage();
    const suggestions: MappingSuggestion[] = [];

    for (const variable of templateVariables) {
      const suggestedMappings: MappingSuggestion['suggestedMappings'] = [];

      // 정확한 변수명 매칭
      for (const template of templates) {
        for (const mapping of template.variableMappings) {
          if (mapping.templateVariable === variable) {
            suggestedMappings.push({
              template,
              mapping,
              confidence: 1.0,
              reason: '정확한 변수명 일치'
            });
          }
        }
      }

      // 유사한 변수명 매칭 (정확한 매칭이 없을 때만)
      if (suggestedMappings.length === 0) {
        for (const template of templates) {
          for (const mapping of template.variableMappings) {
            const similarity = this.calculateSimilarity(variable, mapping.templateVariable);
            if (similarity > 0.7) {
              suggestedMappings.push({
                template,
                mapping,
                confidence: similarity,
                reason: `유사한 변수명 (${Math.round(similarity * 100)}% 일치)`
              });
            }
          }
        }
      }

      // 사용 빈도 기반 정렬
      suggestedMappings.sort((a, b) => {
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        return b.template.usageCount - a.template.usageCount;
      });

      if (suggestedMappings.length > 0) {
        suggestions.push({
          templateVariable: variable,
          suggestedMappings: suggestedMappings.slice(0, 3) // 최대 3개 제안
        });
      }
    }

    return suggestions;
  }

  /**
   * 변수명 유사도 계산 (간단한 Levenshtein distance 기반)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen;
  }

  /**
   * 로컬 스토리지에서 로드
   */
  private static loadFromStorage(): VariableMappingTemplate[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * 로컬 스토리지에 저장
   */
  private static saveToStorage(templates: VariableMappingTemplate[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
    }
  }

  /**
   * 고유 ID 생성
   */
  private static generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 기본 템플릿들 생성 (초기 데이터)
   */
  static initializeDefaultTemplates(): void {
    const existing = this.loadFromStorage();
    if (existing.length > 0) return; // 이미 데이터가 있으면 스킵

    const defaultTemplates: Omit<VariableMappingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
      {
        name: '성과 리포트 기본 변수',
        description: '월간/주간 성과 리포트에 자주 사용되는 변수들',
        category: 'performance',
        tags: ['성과', '리포트', '리뷰', '순위'],
        variableMappings: [
          {
            templateVariable: '#{total_reviews}',
            sourceField: 'SELECT COUNT(*) FROM Reviews WHERE companyId = {adId}',
            sourceType: 'query',
            defaultValue: '0',
            formatter: 'number',
            selectedColumn: 'COUNT(*)'
          },
          {
            templateVariable: '#{monthly_review_count}',
            sourceField: 'SELECT COUNT(*) FROM Reviews WHERE companyId = {adId} AND createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH)',
            sourceType: 'query',
            defaultValue: '0',
            formatter: 'number'
          }
        ],
        isPublic: true
      },
      {
        name: '회사 기본 정보',
        description: '회사명, 연락처 등 기본 정보 변수들',
        category: 'general',
        tags: ['회사', '기본정보', '연락처'],
        variableMappings: [
          {
            templateVariable: '#{companyName}',
            sourceField: 'companyName',
            sourceType: 'field',
            defaultValue: '고객님',
            formatter: 'text'
          },
          {
            templateVariable: '#{contact}',
            sourceField: 'contact_formatted',
            sourceType: 'function',
            defaultValue: '',
            formatter: 'text'
          }
        ],
        isPublic: true
      }
    ];

    for (const template of defaultTemplates) {
      this.saveTemplate(template);
    }
  }
} 