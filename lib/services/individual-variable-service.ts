import fs from 'fs';
import path from 'path';

// 개별 변수 매핑 관리 서비스 (파일 시스템 기반)
export interface IndividualVariableMapping {
  id: string;
  variableName: string;
  displayName: string;
  sourceType: 'field' | 'query' | 'static';
  sourceField?: string;
  selectedColumn?: string;
  defaultValue?: string;
  formatter: 'text' | 'number' | 'date' | 'phone' | 'email';
  category: 'general' | 'personal' | 'business' | 'system';
  tags: string[];
  usageCount: number;
  lastUsedAt?: string;
  isPublic: boolean;
  isFavorite: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class IndividualVariableService {
  private dataDir = path.join(process.cwd(), 'data');
  private filePath = path.join(this.dataDir, 'individual_variable_mappings.json');

  constructor() {
    // 데이터 디렉토리가 없으면 생성
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 파일이 없으면 빈 배열로 초기화
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  // 파일에서 모든 변수 매핑 조회
  getVariableMappings(filter?: {
    category?: string;
    search?: string;
    isPublic?: boolean;
    isFavorite?: boolean;
  }): IndividualVariableMapping[] {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      let mappings: IndividualVariableMapping[] = JSON.parse(data);

      // 필터 적용
      if (filter) {
        if (filter.category && filter.category !== 'all') {
          mappings = mappings.filter(m => m.category === filter.category);
        }
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          mappings = mappings.filter(m => 
            m.variableName.toLowerCase().includes(searchLower) ||
            m.displayName.toLowerCase().includes(searchLower)
          );
        }
        if (filter.isPublic !== undefined) {
          mappings = mappings.filter(m => m.isPublic === filter.isPublic);
        }
        if (filter.isFavorite !== undefined) {
          mappings = mappings.filter(m => m.isFavorite === filter.isFavorite);
        }
      }

      // 사용 횟수와 생성일 기준으로 정렬
      return mappings.sort((a, b) => {
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (error) {
      console.error('변수 매핑 조회 실패:', error);
      return [];
    }
  }

  // 특정 변수 매핑 조회
  getVariableMapping(variableName: string): IndividualVariableMapping | null {
    try {
      const mappings = this.getVariableMappings();
      return mappings.find(m => m.variableName === variableName) || null;
    } catch (error) {
      console.error('변수 매핑 조회 실패:', error);
      return null;
    }
  }

  // 변수 매핑 저장
  saveVariableMapping(mapping: Omit<IndividualVariableMapping, 'id' | 'createdAt' | 'updatedAt'>): IndividualVariableMapping {
    try {
      const mappings = this.getVariableMappings();
      const now = new Date().toISOString();
      
      const newMapping: IndividualVariableMapping = {
        ...mapping,
        id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now
      };

      // 기존에 같은 변수명이 있으면 제거
      const filteredMappings = mappings.filter(m => m.variableName !== mapping.variableName);
      filteredMappings.push(newMapping);

      fs.writeFileSync(this.filePath, JSON.stringify(filteredMappings, null, 2));
      console.log(`✅ 변수 매핑 저장 완료: ${mapping.variableName}`);
      
      return newMapping;
    } catch (error) {
      console.error('변수 매핑 저장 실패:', error);
      throw error;
    }
  }

  // 변수 매핑 업데이트
  updateVariableMapping(id: string, updates: Partial<IndividualVariableMapping>): IndividualVariableMapping | null {
    try {
      const mappings = this.getVariableMappings();
      const index = mappings.findIndex(m => m.id === id);
      
      if (index === -1) {
        return null;
      }

      const updatedMapping = {
        ...mappings[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      mappings[index] = updatedMapping;
      fs.writeFileSync(this.filePath, JSON.stringify(mappings, null, 2));
      console.log(`🔧 변수 매핑 업데이트 완료: ${id}`);
      
      return updatedMapping;
    } catch (error) {
      console.error('변수 매핑 업데이트 실패:', error);
      throw error;
    }
  }

  // 변수 매핑 삭제
  deleteVariableMapping(id: string): boolean {
    try {
      const mappings = this.getVariableMappings();
      const filteredMappings = mappings.filter(m => m.id !== id);
      
      if (filteredMappings.length === mappings.length) {
        return false; // 삭제할 항목이 없음
      }

      fs.writeFileSync(this.filePath, JSON.stringify(filteredMappings, null, 2));
      console.log(`🗑️ 변수 매핑 삭제 완료: ${id}`);
      
      return true;
    } catch (error) {
      console.error('변수 매핑 삭제 실패:', error);
      throw error;
    }
  }

  // 사용 기록
  recordUsage(variableName: string): void {
    try {
      const mappings = this.getVariableMappings();
      const mapping = mappings.find(m => m.variableName === variableName);
      
      if (mapping) {
        mapping.usageCount = (mapping.usageCount || 0) + 1;
        mapping.lastUsedAt = new Date().toISOString();
        mapping.updatedAt = new Date().toISOString();
        
        fs.writeFileSync(this.filePath, JSON.stringify(mappings, null, 2));
        console.log(`📈 변수 사용 기록 완료: ${variableName}`);
      }
    } catch (error) {
      console.error('변수 사용 기록 실패:', error);
    }
  }

  // 자동 제안 생성
  generateSuggestions(variableName: string): Partial<IndividualVariableMapping> {
    const suggestions: Partial<IndividualVariableMapping> = {
      displayName: variableName,
      sourceType: 'field',
      formatter: 'text',
      category: 'general',
      tags: [],
      usageCount: 0,
      isPublic: false,
      isFavorite: false,
      createdBy: 'system'
    };

    // 변수명 기반 자동 추천
    const varLower = variableName.toLowerCase();
    
    if (varLower.includes('name') || varLower.includes('이름')) {
      suggestions.displayName = '이름';
      suggestions.category = 'personal';
      suggestions.formatter = 'text';
    } else if (varLower.includes('phone') || varLower.includes('전화') || varLower.includes('휴대폰')) {
      suggestions.displayName = '전화번호';
      suggestions.category = 'personal';
      suggestions.formatter = 'phone';
    } else if (varLower.includes('email') || varLower.includes('이메일')) {
      suggestions.displayName = '이메일';
      suggestions.category = 'personal';
      suggestions.formatter = 'email';
    } else if (varLower.includes('date') || varLower.includes('날짜') || varLower.includes('시간')) {
      suggestions.displayName = '날짜';
      suggestions.category = 'general';
      suggestions.formatter = 'date';
    } else if (varLower.includes('company') || varLower.includes('회사')) {
      suggestions.displayName = '회사명';
      suggestions.category = 'business';
      suggestions.formatter = 'text';
    }

    return suggestions;
  }
}

// 싱글톤 인스턴스
const individualVariableService = new IndividualVariableService();

export default individualVariableService; 