import { NextResponse } from 'next/server';
import { executeQuery, getDatabaseInfo, testConnection } from '@/lib/database/mysql-connection';

// GET /api/mysql/test - MySQL 연결 테스트
export async function GET() {
  try {
    console.log('MySQL 연결 테스트 시작...');
    
    // 환경변수 확인
    const envVars = {
      host: process.env.MYSQL_READONLY_HOST,
      port: process.env.MYSQL_READONLY_PORT,
      user: process.env.MYSQL_READONLY_USER,
      database: process.env.MYSQL_READONLY_DATABASE,
      hasPassword: !!process.env.MYSQL_READONLY_PASSWORD
    };
    
    console.log('환경변수 상태:', envVars);
    
    // 환경변수가 없으면 에러 반환
    if (!envVars.host || !envVars.user || !envVars.hasPassword) {
      return NextResponse.json({
        success: false,
        error: '환경변수 누락',
        message: '필요한 MySQL 환경변수가 설정되지 않았습니다.',
        envStatus: envVars
      }, { status: 500 });
    }
    
    // 기본 연결 테스트
    const isConnected = await testConnection();
    
    if (!isConnected) {
      return NextResponse.json(
        { 
          success: false,
          error: 'MySQL 연결 실패',
          message: '데이터베이스에 연결할 수 없습니다.',
          envStatus: envVars
        },
        { status: 500 }
      );
    }

    // 데이터베이스 정보 조회
    const dbInfo = await getDatabaseInfo();
    
    // 기본 통계 조회
    const companyCount = await executeQuery('SELECT COUNT(*) as count FROM Companies');
    const tableList = await executeQuery('SHOW TABLES');
    
    return NextResponse.json({
      success: true,
      message: 'MySQL 연결 성공!',
      data: {
        connection: {
          host: process.env.MYSQL_READONLY_HOST,
          database: process.env.MYSQL_READONLY_DATABASE,
          user: process.env.MYSQL_READONLY_USER
        },
        database: dbInfo,
        statistics: {
          totalCompanies: companyCount[0].count,
          totalTables: tableList.length
        },
        tables: tableList.map(table => Object.values(table)[0]).slice(0, 10) // 처음 10개 테이블만
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MySQL 연결 테스트 실패:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'MySQL 연결 테스트 실패',
        details: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        envStatus: {
          host: process.env.MYSQL_READONLY_HOST,
          port: process.env.MYSQL_READONLY_PORT,
          user: process.env.MYSQL_READONLY_USER,
          database: process.env.MYSQL_READONLY_DATABASE,
          hasPassword: !!process.env.MYSQL_READONLY_PASSWORD
        }
      },
      { status: 500 }
    );
  }
} 