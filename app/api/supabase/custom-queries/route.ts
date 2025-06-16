import { NextRequest, NextResponse } from 'next/server';
import supabaseWorkflowService from '@/lib/services/supabase-workflow-service';
import mysql from 'mysql2/promise';

// MySQL 연결 풀 설정
const pool = mysql.createPool({
  host: process.env.MYSQL_READONLY_HOST,
  port: parseInt(process.env.MYSQL_READONLY_PORT || '3306'),
  user: process.env.MYSQL_READONLY_USER,
  password: process.env.MYSQL_READONLY_PASSWORD,
  database: process.env.MYSQL_READONLY_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// SQL 쿼리 검증 (기본적인 보안 체크)
function validateQuery(query: string) {
  const dangerousKeywords = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE',
    'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL'
  ];
  
  const upperQuery = query.toUpperCase();
  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      throw new Error(`보안상 ${keyword} 명령어는 사용할 수 없습니다.`);
    }
  }
  
  // SELECT 문만 허용
  if (!upperQuery.trim().startsWith('SELECT')) {
    throw new Error('SELECT 문만 허용됩니다.');
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const queryName = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (action === 'list') {
      // 모든 커스텀 쿼리 목록 반환
      const result = await supabaseWorkflowService.getCustomQueries();
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }

      const queries = result.data?.map(q => ({
        queryName: q.query_name,
        displayName: q.display_name,
        description: q.description,
        variableCount: q.variables?.length || 0,
        enabled: q.enabled,
        category: q.category,
        usageCount: q.usage_count,
        updatedAt: q.updated_at
      })) || [];
      
      return NextResponse.json({
        success: true,
        queries,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get' && queryName) {
      // 특정 커스텀 쿼리 정보 반환
      const result = await supabaseWorkflowService.getCustomQuery(queryName);
      
      if (!result.success) {
        return NextResponse.json({ 
          success: false,
          error: result.error 
        }, { status: result.error?.includes('찾을 수 없습니다') ? 404 : 500 });
      }

      return NextResponse.json({
        success: true,
        query: {
          queryName: result.data.query_name,
          displayName: result.data.display_name,
          description: result.data.description,
          query: result.data.query_sql,
          variables: result.data.variables,
          enabled: result.data.enabled,
          category: result.data.category,
          usageCount: result.data.usage_count,
          createdAt: result.data.created_at,
          updatedAt: result.data.updated_at
        },
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'execute' && queryName) {
      // 커스텀 쿼리 실행
      const queryResult = await supabaseWorkflowService.getCustomQuery(queryName);
      
      if (!queryResult.success || !queryResult.data?.enabled) {
        return NextResponse.json({ 
          success: false,
          error: '해당 쿼리를 찾을 수 없거나 비활성화되어 있습니다.' 
        }, { status: 404 });
      }

      const startTime = Date.now();
      let executionSuccess = true;
      let errorMessage = '';
      let results: any[] = [];

      try {
        // 쿼리 실행
        validateQuery(queryResult.data.query_sql);
        const [queryResults] = await pool.execute(`${queryResult.data.query_sql} LIMIT ?`, [limit]);
        results = queryResults as any[];
      } catch (error) {
        executionSuccess = false;
        errorMessage = error instanceof Error ? error.message : '쿼리 실행 실패';
      }

      const executionTime = Date.now() - startTime;

      // 실행 로그 기록
      await supabaseWorkflowService.logCustomQueryExecution({
        query_id: queryResult.data.id,
        executed_by: 'system',
        execution_time_ms: executionTime,
        result_count: results.length,
        success: executionSuccess,
        error_message: errorMessage || undefined
      });

      if (!executionSuccess) {
        return NextResponse.json({
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        queryName: queryResult.data.query_name,
        displayName: queryResult.data.display_name,
        results,
        variables: queryResult.data.variables,
        count: results.length,
        executionTime,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'test' && queryName) {
      // 쿼리 테스트 실행 (최대 3개 결과만)
      const queryResult = await supabaseWorkflowService.getCustomQuery(queryName);
      
      if (!queryResult.success) {
        return NextResponse.json({ 
          success: false,
          error: '해당 쿼리를 찾을 수 없습니다.' 
        }, { status: 404 });
      }

      const startTime = Date.now();
      let executionSuccess = true;
      let errorMessage = '';
      let results: any[] = [];

      try {
        validateQuery(queryResult.data.query_sql);
        const [queryResults] = await pool.execute(`${queryResult.data.query_sql} LIMIT 3`);
        results = queryResults as any[];
      } catch (error) {
        executionSuccess = false;
        errorMessage = error instanceof Error ? error.message : '쿼리 테스트 실패';
      }

      const executionTime = Date.now() - startTime;

      // 테스트는 로그에 기록하지 않음

      if (!executionSuccess) {
        return NextResponse.json({
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        queryName: queryResult.data.query_name,
        testResults: results,
        variables: queryResult.data.variables,
        count: results.length,
        executionTime,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'stats') {
      // 커스텀 쿼리 통계 조회
      const result = await supabaseWorkflowService.getCustomQueryStats();
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: false,
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('커스텀 쿼리 처리 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, queryName, queryConfig } = body;

    if (action === 'save') {
      if (!queryName || !queryConfig) {
        return NextResponse.json({ 
          success: false,
          error: 'queryName과 queryConfig가 필요합니다.' 
        }, { status: 400 });
      }

      // 쿼리 검증
      validateQuery(queryConfig.query);

      // 기존 쿼리 확인
      const existingQuery = await supabaseWorkflowService.getCustomQuery(queryName);
      
      let result;
      if (existingQuery.success) {
        // 업데이트
        result = await supabaseWorkflowService.updateCustomQuery(queryName, {
          display_name: queryConfig.displayName,
          description: queryConfig.description,
          query_sql: queryConfig.query,
          variables: queryConfig.variables || [],
          enabled: queryConfig.enabled !== false,
          category: queryConfig.category || 'general'
        });
      } else {
        // 새로 생성
        result = await supabaseWorkflowService.createCustomQuery({
          query_name: queryName,
          display_name: queryConfig.displayName,
          description: queryConfig.description,
          query_sql: queryConfig.query,
          variables: queryConfig.variables || [],
          enabled: queryConfig.enabled !== false,
          category: queryConfig.category || 'general',
          created_by: 'system'
        });
      }

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${queryName} 쿼리가 저장되었습니다.`,
        query: result.data
      });
    }

    if (action === 'delete') {
      if (!queryName) {
        return NextResponse.json({ 
          success: false,
          error: 'queryName이 필요합니다.' 
        }, { status: 400 });
      }

      const result = await supabaseWorkflowService.deleteCustomQuery(queryName);

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${queryName} 쿼리가 삭제되었습니다.`
      });
    }

    if (action === 'toggle') {
      if (!queryName) {
        return NextResponse.json({ 
          success: false,
          error: 'queryName이 필요합니다.' 
        }, { status: 400 });
      }

      // 현재 상태 조회
      const queryResult = await supabaseWorkflowService.getCustomQuery(queryName);
      
      if (!queryResult.success) {
        return NextResponse.json({
          success: false,
          error: '해당 쿼리를 찾을 수 없습니다.'
        }, { status: 404 });
      }

      // 상태 토글
      const newEnabled = !queryResult.data.enabled;
      const result = await supabaseWorkflowService.updateCustomQuery(queryName, {
        enabled: newEnabled
      });

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${queryName} 쿼리가 ${newEnabled ? '활성화' : '비활성화'}되었습니다.`,
        enabled: newEnabled
      });
    }

    return NextResponse.json({ 
      success: false,
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('커스텀 쿼리 저장 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 