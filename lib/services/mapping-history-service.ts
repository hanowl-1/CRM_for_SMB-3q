import type { 
  MappingHistoryTemplate, 
  MappingHistoryTemplateFilter,
  VariableMapping 
} from '@/lib/types/workflow';

export class MappingHistoryService {
  private static readonly STORAGE_KEY = 'mapping_history_templates';

  /**
   * 모든 매핑 이력 템플릿 조회
   */
  static getTemplates(filter?: MappingHistoryTemplateFilter): MappingHistoryTemplate[] {
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
          t.templateContent.toLowerCase().includes(term) ||
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
  static getTemplate(id: string): MappingHistoryTemplate | null {
    const templates = this.loadFromStorage();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * 템플릿 저장
   */
  static saveTemplate(template: Omit<MappingHistoryTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): MappingHistoryTemplate {
    const templates = this.loadFromStorage();
    const now = new Date().toISOString();
    
    const newTemplate: MappingHistoryTemplate = {
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
  static updateTemplate(id: string, updates: Partial<MappingHistoryTemplate>): MappingHistoryTemplate | null {
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
   * 로컬 스토리지에서 로드
   */
  private static loadFromStorage(): MappingHistoryTemplate[] {
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
  private static saveToStorage(templates: MappingHistoryTemplate[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('매핑 이력 템플릿 저장 실패:', error);
    }
  }

  /**
   * 고유 ID 생성
   */
  private static generateId(): string {
    return `mapping_history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 현재 매핑 상태를 이력으로 저장
   */
  static saveCurrentMapping(
    templateContent: string,
    variableMappings: VariableMapping[],
    name: string,
    description: string,
    category: string = 'custom',
    tags: string[] = [],
    isPublic: boolean = false
  ): MappingHistoryTemplate {
    return this.saveTemplate({
      name,
      description,
      templateContent,
      variableMappings: [...variableMappings], // 깊은 복사
      category,
      tags,
      isPublic
    });
  }

  /**
   * 매핑 이력 적용
   */
  static applyMappingHistory(templateId: string): VariableMapping[] | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;
    
    this.recordUsage(templateId);
    return [...template.variableMappings]; // 깊은 복사
  }
} 