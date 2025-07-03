import type { PersonalizationSettings, VariableMapping, PersonalizationTarget } from '@/lib/types/workflow';

export class ClientPersonalizationService {
  /**
   * 템플릿에서 변수를 추출합니다 (#{변수명} 형태)
   */
  extractTemplateVariables(templateContent: string): string[] {
    const variableRegex = /#{([^}]+)}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(templateContent)) !== null) {
      const fullVariable = match[0]; // #{변수명} 전체
      if (!variables.includes(fullVariable)) {
        variables.push(fullVariable);
      }
    }
    
    return variables;
  }

  /**
   * 개인화된 메시지를 생성합니다 (클라이언트 사이드 전용)
   */
  async generatePersonalizedMessages(
    targets: PersonalizationTarget[],
    templateContent: string,
    settings: PersonalizationSettings
  ): Promise<Array<{ target: PersonalizationTarget; personalizedContent: string; error?: string }>> {
    if (!settings.enabled) {
      return targets.map(target => ({
        target,
        personalizedContent: templateContent
      }));
    }

    const results = [];
    
    for (const target of targets) {
      try {
        let personalizedContent = templateContent;
        
        // 각 변수 매핑에 대해 처리
        for (const mapping of settings.variableMappings) {
          const value = await this.resolveVariableValue(target, mapping);
          const formattedValue = this.formatValue(value, mapping.formatter || 'text');
          
          // 템플릿에서 변수를 실제 값으로 교체
          personalizedContent = personalizedContent.replace(
            new RegExp(mapping.templateVariable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            formattedValue
          );
        }
        
        results.push({
          target,
          personalizedContent
        });
      } catch (error) {
        results.push({
          target,
          personalizedContent: templateContent, // 에러 시 원본 템플릿 사용
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }
    
    return results;
  }

  /**
   * 변수 값을 해결합니다 (SQL 쿼리 지원 강화)
   */
  private async resolveVariableValue(target: PersonalizationTarget, mapping: VariableMapping): Promise<any> {
    switch (mapping.sourceType) {
      case 'field':
        // 대상자 데이터에서 직접 필드 값 가져오기
        return target.data?.[mapping.sourceField] || mapping.defaultValue || '';

      case 'query':
        // SQL 쿼리 실행하여 값 가져오기
        try {
          if (!mapping.sourceField) {
            return mapping.defaultValue || '';
          }
          const result = await this.executeSqlQuery(mapping.sourceField, target, mapping.selectedColumn);
          return result || mapping.defaultValue || '';
        } catch (error) {
          console.error(`SQL 쿼리 실행 실패 (${mapping.templateVariable}):`, error);
          return mapping.defaultValue || '';
        }

      case 'function':
        // 내장 함수 실행
        return this.executeBuiltinFunction(mapping.sourceField || '', target) || mapping.defaultValue || '';

      default:
        return mapping.defaultValue || '';
    }
  }

  /**
   * SQL 쿼리를 실행합니다 (대상자별 개인화 지원)
   */
  private async executeSqlQuery(query: string, target: PersonalizationTarget, selectedColumn?: string): Promise<any> {
    try {
      // 쿼리에서 플레이스홀더를 대상자 데이터로 치환
      let processedQuery = query;
      
      // {필드명} 형태의 플레이스홀더를 실제 값으로 치환
      const placeholderRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
      processedQuery = processedQuery.replace(placeholderRegex, (match, fieldName) => {
        const value = target.data?.[fieldName] || (target as any)[fieldName];
        if (value !== undefined) {
          // SQL 인젝션 방지를 위한 기본적인 이스케이핑
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          return String(value);
        }
        return match; // 값이 없으면 원본 플레이스홀더 유지
      });

      // API 호출하여 쿼리 실행
      const response = await fetch('/api/mysql/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: processedQuery,
          limit: 1 // 단일 값만 필요
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`쿼리 실행 실패: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        const row = result.data[0];
        
        // 선택된 컬럼이 있으면 해당 컬럼 값 반환, 없으면 첫 번째 컬럼 값 반환
        if (selectedColumn && row.hasOwnProperty(selectedColumn)) {
          return row[selectedColumn];
        } else {
          const firstKey = Object.keys(row)[0];
          return row[firstKey];
        }
      }
      
      return null;
    } catch (error) {
      console.error('SQL 쿼리 실행 오류:', error);
      throw error;
    }
  }

  /**
   * 내장 함수를 실행합니다
   */
  private executeBuiltinFunction(functionName: string, target: PersonalizationTarget): any {
    switch (functionName) {
      case 'current_date':
        return new Date().toLocaleDateString('ko-KR');
      
      case 'current_month':
        return new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      
      case 'company_name_short':
        const companyName = target.data?.companyName || target.data?.name || '';
        return companyName.length > 10 ? companyName.substring(0, 10) + '...' : companyName;
      
      case 'contact_formatted':
        const contact = target.contact || '';
        return contact.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      
      default:
        return '';
    }
  }

  /**
   * 값을 포맷팅합니다
   */
  private formatValue(value: any, formatter: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    switch (formatter) {
      case 'number':
        const num = parseFloat(stringValue);
        return isNaN(num) ? stringValue : num.toLocaleString('ko-KR');

      case 'currency':
        const currencyNum = parseFloat(stringValue);
        return isNaN(currencyNum) ? stringValue : `${currencyNum.toLocaleString('ko-KR')}원`;

      case 'date':
        try {
          const date = new Date(stringValue);
          return isNaN(date.getTime()) ? stringValue : date.toLocaleDateString('ko-KR');
        } catch {
          return stringValue;
        }

      case 'text':
      default:
        return stringValue;
    }
  }

  /**
   * 변수 매핑 유효성 검사
   */
  validateVariableMappings(
    templateContent: string,
    mappings: VariableMapping[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const templateVariables = this.extractTemplateVariables(templateContent);
    
    // 모든 템플릿 변수가 매핑되었는지 확인
    for (const variable of templateVariables) {
      const mapping = mappings.find(m => m.templateVariable === variable);
      if (!mapping) {
        errors.push(`변수 ${variable}에 대한 매핑이 없습니다.`);
      } else if (!mapping.sourceField && !mapping.defaultValue) {
        errors.push(`변수 ${variable}의 소스 필드 또는 기본값이 설정되지 않았습니다.`);
      }
    }
    
    // 쿼리 기본 유효성 검사
    for (const mapping of mappings) {
      if (mapping.sourceType === 'query' && mapping.sourceField) {
        if (!mapping.sourceField.toLowerCase().trim().startsWith('select')) {
          errors.push(`변수 ${mapping.templateVariable}의 쿼리는 SELECT 문이어야 합니다.`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 쿼리 테스트 (미리보기용)
   */
  async testQuery(query: string, sampleData: Record<string, any>): Promise<{ success: boolean; result?: any; columns?: string[]; data?: any[]; error?: string }> {
    try {
      // 샘플 데이터로 플레이스홀더 치환
      let processedQuery = query;
      const placeholderRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
      processedQuery = processedQuery.replace(placeholderRegex, (match, fieldName) => {
        const value = sampleData[fieldName];
        if (value !== undefined) {
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          return String(value);
        }
        return match;
      });

      console.log('Executing test query:', processedQuery);

      const response = await fetch('/api/mysql/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: processedQuery,
          limit: 10 // 테스트용으로 더 많은 결과 가져오기
        }),
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`쿼리 실행 실패: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const result = await response.json();
      console.log('Query result:', result);
      
      if (result.success && result.data && result.data.length > 0) {
        const firstRow = result.data[0];
        const columns = Object.keys(firstRow);
        
        return {
          success: true,
          result: firstRow[columns[0]], // 기본값: 첫 번째 컬럼
          columns: columns,
          data: result.data
        };
      }
      
      return {
        success: true,
        result: null,
        columns: [],
        data: []
      };
    } catch (error) {
      console.error('Test query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }
}

// 클라이언트 전용 싱글톤 인스턴스 생성
export const clientPersonalizationService = new ClientPersonalizationService(); 