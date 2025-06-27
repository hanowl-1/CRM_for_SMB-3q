import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// MySQL 연결 설정
const dbConfig = {
  host: process.env.MYSQL_READONLY_HOST || 'localhost',
  user: process.env.MYSQL_READONLY_USER || 'root',
  password: process.env.MYSQL_READONLY_PASSWORD || '',
  database: process.env.MYSQL_READONLY_DATABASE || 'crm_database',
  port: parseInt(process.env.MYSQL_READONLY_PORT || '3306'),
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 1000 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { success: false, error: '쿼리가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 보안을 위한 기본적인 쿼리 검증
    const trimmedQuery = query.trim().toLowerCase();
    
    // SELECT 문만 허용
    if (!trimmedQuery.startsWith('select')) {
      return NextResponse.json(
        { success: false, error: 'SELECT 문만 허용됩니다.' },
        { status: 400 }
      );
    }

    // 위험한 키워드 차단
    const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate'];
    if (dangerousKeywords.some(keyword => trimmedQuery.includes(keyword))) {
      return NextResponse.json(
        { success: false, error: '허용되지 않는 SQL 키워드가 포함되어 있습니다.' },
        { status: 400 }
      );
    }

    // MySQL 연결
    const connection = await mysql.createConnection(dbConfig);

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

      return NextResponse.json({
        success: true,
        data: rows,
        rowCount: Array.isArray(rows) ? rows.length : 0
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('MySQL 쿼리 실행 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

// GET 요청도 지원 (테스트용)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testQuery = searchParams.get('test');

  if (testQuery === 'connection') {
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.ping();
      await connection.end();
      
      return NextResponse.json({
        success: true,
        message: 'MySQL 연결 성공'
      });
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error instanceof Error ? error.message : '연결 실패' 
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: 'GET 요청은 테스트 목적으로만 사용됩니다.' },
    { status: 400 }
  );
} 