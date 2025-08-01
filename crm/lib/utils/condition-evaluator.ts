import { WorkflowCondition } from '../types/workflow';

/**
 * 웹훅 이벤트 데이터가 워크플로우 조건을 만족하는지 평가합니다.
 */
export function evaluateConditions(
  eventData: Record<string, any>,
  conditions: WorkflowCondition[],
  conditionLogic: 'AND' | 'OR' = 'AND'
): boolean {
  if (!conditions || conditions.length === 0) {
    return true; // 조건이 없으면 항상 통과
  }

  const results = conditions.map(condition => evaluateCondition(eventData, condition));

  if (conditionLogic === 'AND') {
    return results.every(result => result);
  } else {
    return results.some(result => result);
  }
}

/**
 * 개별 조건을 평가합니다.
 */
export function evaluateCondition(
  eventData: Record<string, any>,
  condition: WorkflowCondition
): boolean {
  const fieldValue = getNestedValue(eventData, condition.field);
  const conditionValue = condition.value;

  console.log(`🔍 조건 평가: ${condition.field} ${condition.operator} ${conditionValue}`);
  console.log(`📋 실제 값: ${fieldValue}`);

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(conditionValue);
    
    case 'not_equals':
      return String(fieldValue) !== String(conditionValue);
    
    case 'contains':
      return String(fieldValue || '').toLowerCase().includes(String(conditionValue).toLowerCase());
    
    case 'greater_than':
      const numericFieldValue = parseFloat(String(fieldValue));
      const numericConditionValue = parseFloat(String(conditionValue));
      return !isNaN(numericFieldValue) && !isNaN(numericConditionValue) && numericFieldValue > numericConditionValue;
    
    case 'less_than':
      const numFieldValue = parseFloat(String(fieldValue));
      const numCondValue = parseFloat(String(conditionValue));
      return !isNaN(numFieldValue) && !isNaN(numCondValue) && numFieldValue < numCondValue;
    
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    
    default:
      console.warn(`⚠️ 지원되지 않는 조건 연산자: ${condition.operator}`);
      return false;
  }
}

/**
 * 중첩된 객체에서 값을 가져옵니다. (예: "user.email", "lead.company")
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * 조건 평가 결과를 시뮬레이션합니다. (테스트용)
 */
export function simulateConditionEvaluation(
  sampleData: Record<string, any>,
  conditions: WorkflowCondition[],
  conditionLogic: 'AND' | 'OR' = 'AND'
): {
  passed: boolean;
  results: Array<{
    condition: WorkflowCondition;
    passed: boolean;
    actualValue: any;
  }>;
} {
  const results = conditions.map(condition => {
    const actualValue = getNestedValue(sampleData, condition.field);
    const passed = evaluateCondition(sampleData, condition);
    
    return {
      condition,
      passed,
      actualValue
    };
  });

  const overallPassed = conditionLogic === 'AND' 
    ? results.every(r => r.passed)
    : results.some(r => r.passed);

  return {
    passed: overallPassed,
    results
  };
} 