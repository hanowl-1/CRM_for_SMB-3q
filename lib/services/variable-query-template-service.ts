import type { 
  VariableQueryTemplate, 
  VariableQueryTemplateFilter 
} from '@/lib/types/workflow';

export class VariableQueryTemplateService {
  private static readonly STORAGE_KEY = 'variable_query_templates';

  /**
   * 모든 변수 쿼리 템플릿 조회
   */
  static getTemplates(filter?: VariableQueryTemplateFilter): VariableQueryTemplate[] {
    const templates = this.loadFromStorage();
    let filtered = templates;

    // 필터링
    if (filter) {
      if (filter.variableName) {
        filtered = filtered.filter(t => t.variableName === filter.variableName);
      }
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
          t.query.toLowerCase().includes(term) ||
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
   * 특정 변수명에 대한 템플릿들 조회
   */
  static getTemplatesForVariable(variableName: string): VariableQueryTemplate[] {
    return this.getTemplates({ variableName });
  }

  /**
   * 특정 템플릿 조회
   */
  static getTemplate(id: string): VariableQueryTemplate | null {
    const templates = this.loadFromStorage();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * 템플릿 저장
   */
  static saveTemplate(template: Omit<VariableQueryTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): VariableQueryTemplate {
    const templates = this.loadFromStorage();
    const now = new Date().toISOString();
    
    const newTemplate: VariableQueryTemplate = {
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
  static updateTemplate(id: string, updates: Partial<VariableQueryTemplate>): VariableQueryTemplate | null {
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
  private static loadFromStorage(): VariableQueryTemplate[] {
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
  private static saveToStorage(templates: VariableQueryTemplate[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('변수 쿼리 템플릿 저장 실패:', error);
    }
  }

  /**
   * 고유 ID 생성
   */
  private static generateId(): string {
    return `var_query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 기본 템플릿들 생성 (초기 데이터)
   */
  static initializeDefaultTemplates(): void {
    // 더미 데이터 제거 - 실제 Supabase 데이터 사용
    console.log('더미 데이터 초기화 제거됨. 실제 Supabase 데이터를 사용합니다.');
  }
} 