import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database/mysql-connection';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, table, conditions, query, limit = 10 } = body;

    console.log('대상 미리보기 요청:', { type, table, query: query?.substring(0, 100), limit });

    let sql = '';
    let params: any[] = [];

    if (type === 'custom_query') {
      // 동적 쿼리 실행
      if (!query || typeof query !== 'string') {
        console.error('잘못된 쿼리:', query);
        return NextResponse.json(
          { success: false, error: 'SQL 쿼리가 필요합니다.' },
          { status: 400 }
        );
      }

      // 쿼리 정리 (공백 및 세미콜론 제거)
      const cleanQuery = query.trim().replace(/;+$/, '');
      
      if (!cleanQuery) {
        return NextResponse.json(
          { success: false, error: '빈 쿼리는 실행할 수 없습니다.' },
          { status: 400 }
        );
      }

      // 보안을 위한 기본적인 쿼리 검증
      const normalizedQuery = cleanQuery.toLowerCase().trim();
      
      // SELECT 문만 허용
      if (!normalizedQuery.startsWith('select')) {
        console.error('SELECT가 아닌 쿼리 시도:', normalizedQuery.substring(0, 50));
        return NextResponse.json(
          { success: false, error: 'SELECT 문만 허용됩니다.' },
          { status: 400 }
        );
      }

      // 위험한 키워드 차단
      const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
      if (dangerousKeywords.some(keyword => normalizedQuery.includes(keyword))) {
        console.error('위험한 키워드 포함:', normalizedQuery.substring(0, 50));
        return NextResponse.json(
          { success: false, error: '허용되지 않는 SQL 명령어가 포함되어 있습니다.' },
          { status: 400 }
        );
      }

      // LIMIT 추가 (미리보기용)
      const previewQuery = `${cleanQuery} LIMIT ${limit}`;
      const countQuery = `SELECT COUNT(*) as total FROM (${cleanQuery}) as subquery`;

      console.log('실행할 쿼리들:', {
        previewQuery: previewQuery.substring(0, 200),
        countQuery: countQuery.substring(0, 200)
      });

      try {
        // 총 개수 조회
        console.log('카운트 쿼리 실행 중...');
        const countResult = await executeQuery(countQuery, []) as any[];
        const totalCount = countResult[0]?.total || 0;
        console.log('총 개수:', totalCount);

        // 미리보기 데이터 조회
        console.log('미리보기 쿼리 실행 중...');
        const previewResult = await executeQuery(previewQuery, []) as any[];
        console.log('미리보기 결과 개수:', previewResult.length);

        return NextResponse.json({
          success: true,
          totalCount,
          preview: previewResult,
          query: previewQuery
        });

      } catch (queryError: any) {
        console.error('쿼리 실행 오류 상세:', {
          message: queryError.message,
          code: queryError.code,
          errno: queryError.errno,
          sqlState: queryError.sqlState,
          sql: queryError.sql
        });
        return NextResponse.json(
          { success: false, error: `쿼리 실행 실패: ${queryError.message}` },
          { status: 400 }
        );
      }

    } else {
      // 기존 정적 조건 방식
      if (!table) {
        return NextResponse.json(
          { success: false, error: '테이블이 지정되지 않았습니다.' },
          { status: 400 }
        );
      }

      // WHERE 조건 구성
      const whereConditions: string[] = [];
      
      if (conditions && conditions.length > 0) {
        conditions.forEach((condition: any) => {
          if (condition.field && condition.value) {
            switch (condition.operator) {
              case 'equals':
                whereConditions.push(`${condition.field} = ?`);
                params.push(condition.value);
                break;
              case 'contains':
                whereConditions.push(`${condition.field} LIKE ?`);
                params.push(`%${condition.value}%`);
                break;
              case 'greater_than':
                whereConditions.push(`${condition.field} > ?`);
                params.push(condition.value);
                break;
              case 'less_than':
                whereConditions.push(`${condition.field} < ?`);
                params.push(condition.value);
                break;
            }
          }
        });
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // 총 개수 조회
      const countSql = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;
      const countResult = await executeQuery(countSql, params) as any[];
      const totalCount = countResult[0]?.total || 0;

      // 미리보기 데이터 조회
      const previewSql = `SELECT * FROM ${table} ${whereClause} LIMIT ${limit}`;
      const previewResult = await executeQuery(previewSql, params) as any[];

      return NextResponse.json({
        success: true,
        totalCount,
        preview: previewResult,
        query: previewSql
      });
    }

  } catch (error: any) {
    console.error('대상 미리보기 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 