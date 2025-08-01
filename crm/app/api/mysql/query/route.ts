import { NextRequest, NextResponse } from 'next/server';
import { createMySQLConnection, MYSQL_READONLY_CONFIG } from '@/lib/config/database';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationError,
  logAndCreateErrorResponse 
} from '@/lib/utils/api-response';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 1000 } = await request.json();

    if (!query) {
      return createValidationError('쿼리가 제공되지 않았습니다.', 'query');
    }

    // 보안을 위한 기본적인 쿼리 검증
    const trimmedQuery = query.trim().toLowerCase();
    
    // SELECT 문만 허용
    if (!trimmedQuery.startsWith('select')) {
      return createValidationError('SELECT 문만 허용됩니다.');
    }

    // 위험한 키워드 차단
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
    if (dangerousKeywords.some(keyword => trimmedQuery.includes(keyword))) {
      return createValidationError('허용되지 않는 SQL 키워드가 포함되어 있습니다.');
    }

    // MySQL 연결
    const connection = await createMySQLConnection(MYSQL_READONLY_CONFIG);

    try {
      // LIMIT 추가 (보안을 위해)
      let finalQuery = query.trim();
      
      // 쿼리 끝의 세미콜론 제거
      if (finalQuery.endsWith(';')) {
        finalQuery = finalQuery.slice(0, -1);
      }
      
      // LIMIT 추가
      if (!trimmedQuery.includes('limit') && limit) {
        finalQuery += ` LIMIT ${Math.min(limit, 50000)}`;
      }

      console.log('Executing query:', finalQuery);

      // 쿼리 실행
      const [rows] = await connection.execute(finalQuery);

      return createSuccessResponse({
        rows,
        rowCount: Array.isArray(rows) ? rows.length : 0
      }, '쿼리 실행 완료');

    } finally {
      await connection.end();
    }

  } catch (error) {
    return logAndCreateErrorResponse(error, 'MySQL 쿼리 실행', '쿼리 실행 중 오류가 발생했습니다.');
  }
}

// GET 요청도 지원 (테스트용)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testQuery = searchParams.get('test');

  if (testQuery === 'connection') {
    try {
      const connection = await createMySQLConnection(MYSQL_READONLY_CONFIG);
      await connection.ping();
      await connection.end();
      
      return createSuccessResponse(null, 'MySQL 연결 성공');
    } catch (error) {
      return logAndCreateErrorResponse(error, 'MySQL 연결 테스트', 'MySQL 연결 실패');
    }
  }

  return createValidationError('GET 요청은 테스트 목적으로만 사용됩니다.');
} 