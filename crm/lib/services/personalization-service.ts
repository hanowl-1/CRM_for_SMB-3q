/**
 * 🎯 개인화 서비스
 * 
 * 워크플로우 실행과 미리보기에서 공통으로 사용되는 개인화 로직을 제공합니다.
 * individual_variable_mappings 테이블 기반 변수 매핑 처리를 담당합니다.
 */

import { getSupabase } from '@/lib/database/supabase-client';
import { executeQuery } from '@/lib/database/mysql-connection.js';

export interface PersonalizationMapping {
  variableName: string;
  sourceType: 'mysql_query' | 'static_value' | 'webhook_data';
  sourceConfig: {
    query?: string;
    staticValue?: string;
    webhookField?: string;
    matchingColumn?: string;
    outputColumn?: string;
  };
  defaultValue: string;
}

export interface PersonalizationContext {
  target: Record<string, any>;
  webhookData?: Record<string, any>;
  templateId: string;
  workflowId: string;
}

export interface PersonalizationResult {
  success: boolean;
  personalizedMessage: string;
  variables: Record<string, string>;
  errors?: string[];
}

/**
 * 개별 변수 매핑을 조회합니다.
 */
export async function getPersonalizationMappings(
  templateId: string,
  workflowId: string
): Promise<PersonalizationMapping[]> {
  try {
    console.log(`📋 개별 변수 매핑 조회 시작: 템플릿 ${templateId}, 워크플로우 ${workflowId}`);
    
    const supabase = getSupabase();
    const { data: mappings, error } = await supabase
      .from('individual_variable_mappings')
      .select('*')
      .or(`template_id.eq.${templateId},workflow_id.eq.${workflowId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ 개별 변수 매핑 조회 실패:', error);
      return [];
    }

    console.log(`✅ 개별 변수 매핑 ${mappings?.length || 0}개 조회 완료`);
    
    return mappings?.map(mapping => ({
      variableName: mapping.variable_name,
      sourceType: mapping.source_type,
      sourceConfig: {
        query: mapping.source_config?.query,
        staticValue: mapping.source_config?.staticValue,
        webhookField: mapping.source_config?.webhookField,
        matchingColumn: mapping.source_config?.matchingColumn,
        outputColumn: mapping.source_config?.outputColumn,
      },
      defaultValue: mapping.default_value || '--'
    })) || [];
  } catch (error) {
    console.error('❌ 개별 변수 매핑 조회 중 오류:', error);
    return [];
  }
}

/**
 * MySQL 쿼리를 실행하여 변수 데이터를 조회합니다.
 */
export async function executeVariableQuery(
  query: string,
  limit = 10000
): Promise<Record<string, any>[]> {
  try {
    console.log(`🔍 변수 쿼리 실행: ${query.substring(0, 100)}...`);
    
    // MySQL API를 통해 쿼리 실행
    const response = await fetch('/api/mysql/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit })
    });

    if (!response.ok) {
      throw new Error(`쿼리 API 호출 실패: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`변수 쿼리 실패: ${result.error}`);
    }
    
    console.log(`✅ 변수 쿼리 완료: ${result.data?.rows?.length || 0}개 레코드`);
    return result.data?.rows || [];
  } catch (error) {
    console.error('❌ 변수 쿼리 실행 실패:', error);
    throw error;
  }
}

/**
 * 대상자와 변수 데이터를 매칭합니다.
 */
export function matchVariableData(
  target: Record<string, any>,
  variableData: Record<string, any>[],
  matchingColumn: string,
  targetMatchingColumn: string,
  outputColumn: string
): string | null {
  try {
    const targetValue = target[targetMatchingColumn];
    if (!targetValue) {
      console.log(`⚠️ 대상자 매칭 컬럼 값 없음: ${targetMatchingColumn}`);
      return null;
    }

    // 대소문자 구분 없이 매칭
    const matchedRow = variableData.find(row => {
      const variableValue = row[matchingColumn];
      if (!variableValue) return false;
      
      return String(variableValue).toLowerCase() === String(targetValue).toLowerCase();
    });

    if (matchedRow) {
      const outputValue = matchedRow[outputColumn];
      console.log(`✅ 매칭 성공: ${targetValue} → ${outputValue}`);
      return String(outputValue);
    }

    console.log(`⚠️ 매칭 실패: ${targetValue} (${matchingColumn}에서 찾을 수 없음)`);
    return null;
  } catch (error) {
    console.error('❌ 변수 데이터 매칭 중 오류:', error);
    return null;
  }
}

/**
 * 메시지를 개인화합니다.
 */
export async function personalizeMessage(
  templateContent: string,
  context: PersonalizationContext
): Promise<PersonalizationResult> {
  try {
    console.log(`🎯 메시지 개인화 시작: 템플릿 ${context.templateId}`);
    
    const mappings = await getPersonalizationMappings(context.templateId, context.workflowId);
    const variables: Record<string, string> = {};
    const errors: string[] = [];
    
    let personalizedMessage = templateContent;

    // 각 매핑에 대해 개인화 수행
    for (const mapping of mappings) {
      try {
        let finalValue = mapping.defaultValue;

        switch (mapping.sourceType) {
          case 'static_value':
            finalValue = mapping.sourceConfig.staticValue || mapping.defaultValue;
            console.log(`📝 정적 값: ${mapping.variableName} = ${finalValue}`);
            break;

          case 'webhook_data':
            if (context.webhookData && mapping.sourceConfig.webhookField) {
              const webhookValue = context.webhookData[mapping.sourceConfig.webhookField];
              if (webhookValue) {
                finalValue = String(webhookValue);
                console.log(`🔔 웹훅 데이터: ${mapping.variableName} = ${finalValue}`);
              }
            }
            break;

          case 'mysql_query':
            if (mapping.sourceConfig.query && mapping.sourceConfig.matchingColumn && mapping.sourceConfig.outputColumn) {
              const variableData = await executeVariableQuery(mapping.sourceConfig.query);
              const matchedValue = matchVariableData(
                context.target,
                variableData,
                mapping.sourceConfig.matchingColumn,
                mapping.sourceConfig.matchingColumn, // 대상자 쿼리와 동일한 컬럼명 가정
                mapping.sourceConfig.outputColumn
              );
              
              if (matchedValue) {
                finalValue = matchedValue;
                console.log(`🔍 MySQL 쿼리: ${mapping.variableName} = ${finalValue}`);
              }
            }
            break;
        }

        variables[mapping.variableName] = finalValue;
        
        // 메시지에서 변수 치환
        const variablePattern = new RegExp(`#{${mapping.variableName}}`, 'g');
        personalizedMessage = personalizedMessage.replace(variablePattern, finalValue);
        
      } catch (error) {
        const errorMsg = `${mapping.variableName} 개인화 실패: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        
        // 오류 시 기본값 사용
        variables[mapping.variableName] = mapping.defaultValue;
        const variablePattern = new RegExp(`#{${mapping.variableName}}`, 'g');
        personalizedMessage = personalizedMessage.replace(variablePattern, mapping.defaultValue);
      }
    }

    console.log(`✅ 메시지 개인화 완료: ${Object.keys(variables).length}개 변수 처리`);
    
    return {
      success: errors.length === 0,
      personalizedMessage,
      variables,
      errors: errors.length > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('❌ 메시지 개인화 중 전체 오류:', error);
    return {
      success: false,
      personalizedMessage: templateContent,
      variables: {},
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * 여러 대상자에 대해 일괄 개인화를 수행합니다.
 */
export async function personalizeBatch(
  templateContent: string,
  targets: Record<string, any>[],
  templateId: string,
  workflowId: string,
  webhookData?: Record<string, any>
): Promise<PersonalizationResult[]> {
  console.log(`🎯 일괄 개인화 시작: ${targets.length}명 대상`);
  
  const results: PersonalizationResult[] = [];
  
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`📋 ${i + 1}/${targets.length} 개인화 처리 중...`);
    
    const result = await personalizeMessage(templateContent, {
      target,
      webhookData,
      templateId,
      workflowId
    });
    
    results.push(result);
  }
  
  console.log(`✅ 일괄 개인화 완료: ${results.length}명 처리`);
  return results;
} 