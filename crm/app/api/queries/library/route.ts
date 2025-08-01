import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';
import crypto from 'crypto';

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

// SQL을 기반으로 고유 ID 생성
function generateQueryId(sql: string): string {
  return crypto.createHash('md5').update(sql.trim()).digest('hex').substring(0, 8);
}

// SQL 쿼리 카테고리 분류
function categorizeQuery(sql: string): string {
  const sqlLower = sql.toLowerCase();
  
  if (sqlLower.includes('count(') || sqlLower.includes('sum(') || sqlLower.includes('avg(') || sqlLower.includes('max(') || sqlLower.includes('min(')) {
    return '집계';
  } else if (sqlLower.includes('group by')) {
    return '그룹화';
  } else if (sqlLower.includes('join')) {
    return '조인';
  } else if (sqlLower.includes('order by')) {
    return '정렬';
  } else if (sqlLower.includes('date') || sqlLower.includes('timestamp') || sqlLower.includes('created_at') || sqlLower.includes('updated_at')) {
    return '날짜조회';
  } else if (sqlLower.includes('case when') || sqlLower.includes('if(')) {
    return '통계';
  } else {
    return '기본조회';
  }
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

    // 저장된 개별 변수 템플릿도 조회
    const individualTemplates = await supabaseWorkflowService.getIndividualVariableMappings();
    console.log(`📋 총 ${individualTemplates.length}개 개별 변수 템플릿 조회됨`);

    // 쿼리 라이브러리 맵
    const queryLibrary = new Map<string, QueryLibraryItem>();

    // 개별 변수 템플릿에서 쿼리 추가
    individualTemplates.forEach((template: any) => {
      if (template.sourceType === 'query' && template.sourceField && template.sourceField.trim()) {
        const sql = template.sourceField.trim();
        const queryId = generateQueryId(sql);
        
        if (!queryLibrary.has(queryId)) {
          queryLibrary.set(queryId, {
            id: queryId,
            name: template.displayName || `${template.variableName} 쿼리`,
            description: `${template.variableName} 값을 조회하는 저장된 템플릿`,
            sql: sql,
            category: template.category || categorizeQuery(sql),
            usageCount: template.usageCount || 0,
            lastUsed: template.lastUsedAt,
            createdAt: template.createdAt || new Date().toISOString(),
            updatedAt: template.updatedAt || new Date().toISOString(),
            usedInTemplates: []
          });
        }
        
        const queryItem = queryLibrary.get(queryId)!;
        // 저장된 템플릿 정보 추가
        queryItem.usedInTemplates.push({
          templateCode: 'SAVED_TEMPLATE',
          templateName: template.displayName || template.variableName,
          variableName: template.variableName,
          workflowId: 'saved',
          workflowName: '저장된 템플릿'
        });
      }
    });

    // 각 워크플로우에서 사용 중인 쿼리 추출
    workflows.forEach((workflow: any) => {
      const messageConfig = workflow.message_config;
      const steps = messageConfig?.steps || [];
      
      steps.forEach((step: any) => {
        const action = step.action;
        // 실제 데이터 구조에 맞게 수정: 'send_alimtalk'로 변경하고 personalization에서 쿼리 추출
        if (action?.type === 'send_alimtalk' && action.personalization?.variableMappings) {
          const variableMappings = action.personalization.variableMappings;
          
          // 각 변수 매핑에서 쿼리 확인
          variableMappings.forEach((mapping: any) => {
            if (mapping.sourceType === 'query' && mapping.sourceField && mapping.sourceField.trim()) {
              const sql = mapping.sourceField.trim();
              const queryId = generateQueryId(sql);
              
              if (!queryLibrary.has(queryId)) {
                queryLibrary.set(queryId, {
                  id: queryId,
                  name: `${mapping.templateVariable} 쿼리` || '이름 없는 쿼리',
                  description: `${mapping.templateVariable} 값을 조회하는 쿼리`,
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
                variableName: mapping.templateVariable || 'unknown',
                workflowId: workflow.id,
                workflowName: workflow.name
              };
              
              // 중복 제거
              const existingUsage = queryItem.usedInTemplates.find(
                u => u.templateCode === templateUsage.templateCode && 
                     u.variableName === templateUsage.variableName &&
                     u.workflowId === templateUsage.workflowId
              );
              
              if (!existingUsage) {
                queryItem.usedInTemplates.push(templateUsage);
              }
            }
          });
        }
      });
    });

    // 카테고리별 통계
    const categories = new Map<string, number>();
    queryLibrary.forEach(query => {
      categories.set(query.category, (categories.get(query.category) || 0) + 1);
    });

    // 결과 정렬 (사용 빈도순)
    const sortedQueries = Array.from(queryLibrary.values())
      .sort((a, b) => b.usageCount - a.usageCount);

    console.log(`✅ 쿼리 라이브러리 분석 완료: ${sortedQueries.length}개 쿼리`);
    console.log('📊 쿼리 통계:', sortedQueries.map(q => ({
      id: q.id,
      name: q.name,
      category: q.category,
      usageCount: q.usageCount,
      usedInTemplatesCount: q.usedInTemplates.length
    })));

    return NextResponse.json({
      success: true,
      data: {
        totalQueries: sortedQueries.length,
        categories: Array.from(categories.entries()).map(([name, count]) => ({ name, count })),
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