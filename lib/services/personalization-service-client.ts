import type { PersonalizationSettings, VariableMapping, PersonalizationTarget } from '@/lib/types/workflow';

export class ClientPersonalizationService {
  /**
   * 템플릿에서 변수를 추출합니다 (#변수명 형태)
   */
  extractTemplateVariables(templateContent: string): string[] {
    const variableRegex = /#([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(templateContent)) !== null) {
      if (!variables.includes(match[0])) {
        variables.push(match[0]);
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
          const formattedValue = this.formatValue(value, mapping.formatter);
          
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
   * 변수 매핑에 따라 실제 값을 해결합니다
   */
  private async resolveVariableValue(
    target: PersonalizationTarget,
    mapping: VariableMapping
  ): Promise<string> {
    switch (mapping.sourceType) {
      case 'field':
        return this.resolveFieldValue(target, mapping);
      
      case 'query':
        return await this.resolveQueryValue(target, mapping);
      
      case 'function':
        return this.resolveFunctionValue(target, mapping);
      
      default:
        return mapping.defaultValue || '';
    }
  }

  /**
   * 필드 기반 값 해결
   */
  private resolveFieldValue(target: PersonalizationTarget, mapping: VariableMapping): string {
    const value = target.data[mapping.sourceField];
    return value !== undefined && value !== null ? String(value) : mapping.defaultValue || '';
  }

  /**
   * 쿼리 기반 값 해결 (API 호출)
   */
  private async resolveQueryValue(target: PersonalizationTarget, mapping: VariableMapping): Promise<string> {
    try {
      // 쿼리에서 {필드명} 형태의 플레이스홀더를 실제 값으로 교체
      let query = mapping.sourceField;
      const placeholderRegex = /\{([^}]+)\}/g;
      let match;
      
      while ((match = placeholderRegex.exec(mapping.sourceField)) !== null) {
        const fieldName = match[1];
        const fieldValue = target.data[fieldName];
        if (fieldValue !== undefined && fieldValue !== null) {
          query = query.replace(match[0], String(fieldValue));
        }
      }

      // API를 통해 쿼리 실행
      const response = await fetch('/api/mysql/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`쿼리 실행 실패: ${response.statusText}`);
      }

      const result = await response.json();
      
      // 첫 번째 행의 첫 번째 컬럼 값을 반환
      if (result.data && result.data.length > 0) {
        const firstRow = result.data[0];
        const firstValue = Object.values(firstRow)[0];
        return firstValue !== undefined && firstValue !== null ? String(firstValue) : mapping.defaultValue || '';
      }
      
      return mapping.defaultValue || '';
    } catch (error) {
      console.error('쿼리 실행 중 오류:', error);
      return mapping.defaultValue || '';
    }
  }

  /**
   * 함수 기반 값 해결
   */
  private resolveFunctionValue(target: PersonalizationTarget, mapping: VariableMapping): string {
    switch (mapping.sourceField) {
      case 'current_date':
        return new Date().toLocaleDateString('ko-KR');
      
      case 'current_month':
        return new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
      
      case 'company_name_short':
        const companyName = target.data.companyName || target.data.company_name || '';
        return companyName.length > 10 ? companyName.substring(0, 10) + '...' : companyName;
      
      default:
        return mapping.defaultValue || '';
    }
  }

  /**
   * 값을 지정된 형식으로 포맷팅합니다
   */
  private formatValue(value: string, formatter?: string): string {
    if (!value) return value;
    
    switch (formatter) {
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? value : num.toLocaleString('ko-KR');
      
      case 'currency':
        const currency = parseFloat(value);
        return isNaN(currency) ? value : currency.toLocaleString('ko-KR') + '원';
      
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toLocaleDateString('ko-KR');
      
      case 'text':
      default:
        return value;
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
}

// 클라이언트 전용 싱글톤 인스턴스 생성
export const clientPersonalizationService = new ClientPersonalizationService(); 