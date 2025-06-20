import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';

interface QueryLibraryItem {
  id: string;
  name: string;
  description: string;
  sql: string;
  category: string;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  usedInTemplates: Array<{
    templateCode: string;
    templateName: string;
    variableName: string;
    workflowId: string;
    workflowName: string;
  }>;
}

// GET: 쿼리 라이브러리 조회
export async function GET(request: NextRequest) {
  try {
    console.log('📚 쿼리 라이브러리 조회 시작...');
    
    // 모든 워크플로우 조회
    const workflowsResult = await supabaseWorkflowService.getWorkflows(1000, 0);
    
    if (!workflowsResult.success) {
      return NextResponse.json({
        success: false,
        message: workflowsResult.error || '워크플로우 조회에 실패했습니다.'
      }, { status: 500 });
    }

    const workflows = workflowsResult.data || [];
    console.log(`📋 총 ${workflows.length}개 워크플로우 조회됨`);

    // 쿼리 라이브러리 맵
    const queryLibrary = new Map<string, QueryLibraryItem>();

    // 각 워크플로우에서 사용 중인 쿼리 추출
    workflows.forEach((workflow: any) => {
      const messageConfig = workflow.message_config;
      const steps = messageConfig?.steps || [];
      
      steps.forEach((step: any) => {
        const action = step.action;
        if (action?.type === 'kakao_alimtalk' && action.variables) {
          const variables = action.variables;
          
          // 각 변수의 쿼리 확인
          Object.entries(variables).forEach(([variableName, variableConfig]: [string, any]) => {
            if (variableConfig?.source === 'query' && variableConfig.query) {
              const sql = variableConfig.query;
              const queryId = generateQueryId(sql); // SQL을 기반으로 고유 ID 생성
              
              if (!queryLibrary.has(queryId)) {
                queryLibrary.set(queryId, {
                  id: queryId,
                  name: variableConfig.name || variableName,
                  description: variableConfig.description || `${variableName} 값을 조회하는 쿼리`,
                  sql: sql,
                  category: categorizeQuery(sql),
                  usageCount: 0,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  usedInTemplates: []
                });
              }
              
              const queryItem = queryLibrary.get(queryId)!;
              queryItem.usageCount++;
              queryItem.lastUsed = workflow.last_run_at || workflow.updated_at;
              
              // 사용처 정보 추가
              const templateUsage = {
                templateCode: action.templateCode || 'UNKNOWN',
                templateName: action.templateName || step.name || '알 수 없는 템플릿',
                variableName,
                workflowId: workflow.id,
                workflowName: workflow.name
              };
              
              // 중복 제거
              const existingUsage = queryItem.usedInTemplates.find(
                u => u.workflowId === workflow.id && u.variableName === variableName
              );
              
              if (!existingUsage) {
                queryItem.usedInTemplates.push(templateUsage);
              }
            }
          });
        }
      });
    });

    // 결과 정렬 (사용 빈도순)
    const sortedQueries = Array.from(queryLibrary.values())
      .sort((a, b) => b.usageCount - a.usageCount);

    console.log(`✅ 쿼리 라이브러리 분석 완료: ${sortedQueries.length}개 쿼리`);

    return NextResponse.json({
      success: true,
      data: {
        totalQueries: sortedQueries.length,
        categories: getQueryCategories(sortedQueries),
        queries: sortedQueries
      },
      message: '쿼리 라이브러리를 성공적으로 조회했습니다.'
    });

  } catch (error) {
    console.error('❌ 쿼리 라이브러리 조회 실패:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '쿼리 라이브러리 조회에 실패했습니다.',
      error: error
    }, { status: 500 });
  }
}

// SQL을 기반으로 고유 ID 생성
function generateQueryId(sql: string): string {
  // SQL을 정규화하고 해시 생성
  const normalizedSql = sql
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  
  // 간단한 해시 함수 (실제로는 crypto.createHash 사용 권장)
  let hash = 0;
  for (let i = 0; i < normalizedSql.length; i++) {
    const char = normalizedSql.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  
  return `query_${Math.abs(hash).toString(36)}`;
}

// 쿼리 카테고리 분류
function categorizeQuery(sql: string): string {
  const lowerSql = sql.toLowerCase();
  
  if (lowerSql.includes('count(')) {
    return '집계';
  } else if (lowerSql.includes('sum(') || lowerSql.includes('avg(') || lowerSql.includes('max(') || lowerSql.includes('min(')) {
    return '통계';
  } else if (lowerSql.includes('join')) {
    return '조인';
  } else if (lowerSql.includes('where') && lowerSql.includes('date')) {
    return '날짜조회';
  } else if (lowerSql.includes('order by')) {
    return '정렬';
  } else if (lowerSql.includes('group by')) {
    return '그룹화';
  } else {
    return '기본조회';
  }
}

// 카테고리 통계 생성
function getQueryCategories(queries: QueryLibraryItem[]) {
  const categories = new Map<string, number>();
  
  queries.forEach(query => {
    const count = categories.get(query.category) || 0;
    categories.set(query.category, count + 1);
  });
  
  return Array.from(categories.entries()).map(([name, count]) => ({
    name,
    count
  }));
} 