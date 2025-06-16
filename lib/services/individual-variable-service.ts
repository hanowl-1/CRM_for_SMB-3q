import { supabaseWorkflowService } from './supabase-workflow-service';

export interface IndividualVariableMapping {
  id?: string;
  variableName: string; // #{companyName}
  displayName?: string; // "회사명"
  sourceType: 'field' | 'query' | 'function';
  sourceField?: string; // 필드명 또는 쿼리 또는 함수명
  selectedColumn?: string; // 쿼리 결과 컬럼
  defaultValue?: string;
  formatter: 'text' | 'number' | 'currency' | 'date';
  category?: string;
  tags?: string[];
  usageCount?: number;
  lastUsedAt?: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class IndividualVariableService {
  private static readonly STORAGE_KEY = 'individual_variable_mappings';

  /**
   * 개별 변수 매핑 목록 조회
   */
  static async getVariableMappings(): Promise<IndividualVariableMapping[]> {
    try {
      console.log('🔍 개별 변수 매핑 조회 시작...');
      
      // Supabase 우선 시도
      const supabaseData = await supabaseWorkflowService.getIndividualVariableMappings();
      if (supabaseData && supabaseData.length > 0) {
        console.log(`📊 Supabase에서 ${supabaseData.length}개 개별 변수 매핑 조회`);
        // localStorage에 백업
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(supabaseData));
        return supabaseData;
      }
    } catch (error) {
      console.warn('⚠️ Supabase 조회 실패, localStorage 백업 사용:', error);
    }

    // localStorage 백업 사용
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : [];
      console.log(`📊 localStorage에서 ${data.length}개 개별 변수 매핑 조회`);
      return data;
    } catch (error) {
      console.error('❌ localStorage 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 변수 매핑 조회
   */
  static async getVariableMapping(variableName: string): Promise<IndividualVariableMapping | null> {
    try {
      console.log(`🔍 변수 매핑 조회: ${variableName}`);
      
      // Supabase 우선 시도
      const supabaseData = await supabaseWorkflowService.getIndividualVariableMapping(variableName);
      if (supabaseData) {
        console.log(`📋 Supabase에서 변수 매핑 조회 성공: ${variableName}`);
        return supabaseData;
      }
    } catch (error) {
      console.warn('⚠️ Supabase 조회 실패, localStorage 백업 사용:', error);
    }

    // localStorage 백업 사용
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const data: IndividualVariableMapping[] = stored ? JSON.parse(stored) : [];
      const found = data.find(mapping => mapping.variableName === variableName);
      console.log(`📋 localStorage에서 변수 매핑 조회:`, found ? '성공' : '없음');
      return found || null;
    } catch (error) {
      console.error('❌ localStorage 조회 실패:', error);
      return null;
    }
  }

  /**
   * 변수 매핑 저장
   */
  static async saveVariableMapping(mapping: IndividualVariableMapping): Promise<IndividualVariableMapping> {
    try {
      console.log(`💾 변수 매핑 저장: ${mapping.variableName}`);
      
      // Supabase 우선 시도
      const saved = await supabaseWorkflowService.createIndividualVariableMapping(mapping);
      if (saved) {
        console.log(`✅ Supabase에 변수 매핑 저장 성공: ${mapping.variableName}`);
        
        // localStorage에도 백업
        await this.updateLocalStorage(saved, 'create');
        return saved;
      }
    } catch (error) {
      console.warn('⚠️ Supabase 저장 실패, localStorage만 사용:', error);
    }

    // localStorage 백업 사용
    try {
      const newMapping: IndividualVariableMapping = {
        ...mapping,
        id: mapping.id || `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: mapping.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: mapping.usageCount || 0
      };

      await this.updateLocalStorage(newMapping, 'create');
      console.log(`💾 localStorage에 변수 매핑 저장 완료: ${mapping.variableName}`);
      return newMapping;
    } catch (error) {
      console.error('❌ 변수 매핑 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 변수 매핑 업데이트
   */
  static async updateVariableMapping(id: string, updates: Partial<IndividualVariableMapping>): Promise<IndividualVariableMapping | null> {
    try {
      console.log(`🔧 변수 매핑 업데이트: ${id}`);
      
      // Supabase 우선 시도
      const updated = await supabaseWorkflowService.updateIndividualVariableMapping(id, updates);
      if (updated) {
        console.log(`✅ Supabase에서 변수 매핑 업데이트 성공: ${id}`);
        
        // localStorage에도 백업
        await this.updateLocalStorage(updated, 'update');
        return updated;
      }
    } catch (error) {
      console.warn('⚠️ Supabase 업데이트 실패, localStorage만 사용:', error);
    }

    // localStorage 백업 사용
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const data: IndividualVariableMapping[] = stored ? JSON.parse(stored) : [];
      const index = data.findIndex(mapping => mapping.id === id);
      
      if (index === -1) {
        console.warn(`⚠️ 변수 매핑을 찾을 수 없음: ${id}`);
        return null;
      }

      const updated = {
        ...data[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      data[index] = updated;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log(`🔧 localStorage에서 변수 매핑 업데이트 완료: ${id}`);
      return updated;
    } catch (error) {
      console.error('❌ 변수 매핑 업데이트 실패:', error);
      return null;
    }
  }

  /**
   * 변수 매핑 삭제
   */
  static async deleteVariableMapping(id: string): Promise<boolean> {
    try {
      console.log(`🗑️ 변수 매핑 삭제: ${id}`);
      
      // Supabase 우선 시도
      const deleted = await supabaseWorkflowService.deleteIndividualVariableMapping(id);
      if (deleted) {
        console.log(`✅ Supabase에서 변수 매핑 삭제 성공: ${id}`);
        
        // localStorage에서도 삭제
        await this.updateLocalStorage({ id } as IndividualVariableMapping, 'delete');
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Supabase 삭제 실패, localStorage만 사용:', error);
    }

    // localStorage 백업 사용
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const data: IndividualVariableMapping[] = stored ? JSON.parse(stored) : [];
      const filtered = data.filter(mapping => mapping.id !== id);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      console.log(`🗑️ localStorage에서 변수 매핑 삭제 완료: ${id}`);
      return true;
    } catch (error) {
      console.error('❌ 변수 매핑 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 사용 횟수 증가
   */
  static async recordUsage(variableName: string): Promise<void> {
    try {
      console.log(`📈 변수 매핑 사용 기록: ${variableName}`);
      
      // Supabase 우선 시도
      await supabaseWorkflowService.recordIndividualVariableMappingUsage(variableName);
      console.log(`✅ Supabase에서 사용 기록 완료: ${variableName}`);
    } catch (error) {
      console.warn('⚠️ Supabase 사용 기록 실패, localStorage만 사용:', error);
      
      // localStorage 백업 사용
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        const data: IndividualVariableMapping[] = stored ? JSON.parse(stored) : [];
        const index = data.findIndex(mapping => mapping.variableName === variableName);
        
        if (index !== -1) {
          data[index].usageCount = (data[index].usageCount || 0) + 1;
          data[index].lastUsedAt = new Date().toISOString();
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
          console.log(`📈 localStorage에서 사용 기록 완료: ${variableName}`);
        }
      } catch (error) {
        console.error('❌ 사용 기록 실패:', error);
      }
    }
  }

  /**
   * localStorage 업데이트 헬퍼
   */
  private static async updateLocalStorage(
    mapping: IndividualVariableMapping, 
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      let data: IndividualVariableMapping[] = stored ? JSON.parse(stored) : [];

      switch (action) {
        case 'create':
          data.push(mapping);
          break;
        case 'update':
          const updateIndex = data.findIndex(item => item.id === mapping.id);
          if (updateIndex !== -1) {
            data[updateIndex] = mapping;
          }
          break;
        case 'delete':
          data = data.filter(item => item.id !== mapping.id);
          break;
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('❌ localStorage 업데이트 실패:', error);
    }
  }

  /**
   * 변수명으로 자동 제안 생성
   */
  static generateSuggestions(variableName: string): Partial<IndividualVariableMapping> {
    const cleanName = variableName.replace(/^#{|}$/g, '');
    
    // 변수명 기반 자동 제안
    const suggestions: Record<string, Partial<IndividualVariableMapping>> = {
      'companyName': {
        displayName: '회사명',
        sourceType: 'field',
        sourceField: 'companyName',
        category: 'company',
        formatter: 'text'
      },
      'totalReviews': {
        displayName: '총 리뷰 수',
        sourceType: 'field',
        sourceField: 'totalReviews',
        category: 'performance',
        formatter: 'number'
      },
      'averageRating': {
        displayName: '평균 평점',
        sourceType: 'field',
        sourceField: 'averageRating',
        category: 'performance',
        formatter: 'number'
      },
      'monthlyRevenue': {
        displayName: '월 매출',
        sourceType: 'field',
        sourceField: 'monthlyRevenue',
        category: 'finance',
        formatter: 'currency'
      },
      'customerName': {
        displayName: '고객명',
        sourceType: 'field',
        sourceField: 'customerName',
        category: 'customer',
        formatter: 'text'
      }
    };

    return suggestions[cleanName] || {
      displayName: cleanName,
      sourceType: 'field',
      sourceField: cleanName,
      category: 'general',
      formatter: 'text'
    };
  }
} 