import { NextResponse } from 'next/server';

// GET /api/mysql/test - MySQL 연결 테스트
export async function GET() {
  try {
    console.log('MySQL 연결 테스트 시작...');
    
    // 환경변수 확인
    const envVars = {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      hasPassword: !!process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    };
    
    console.log('MySQL 환경변수 상태:', envVars);
    
    // 환경변수가 없으면 에러 반환
    if (!envVars.host || !envVars.user || !envVars.database) {
      return NextResponse.json({
        success: false,
        error: 'MySQL 환경변수 누락',
        message: '필요한 MySQL 환경변수가 설정되지 않았습니다.',
        envStatus: envVars,
        required: {
          MYSQL_HOST: '필수',
          MYSQL_USER: '필수',
          MYSQL_PASSWORD: '필수',
          MYSQL_DATABASE: '필수',
          MYSQL_PORT: '선택사항 (기본값: 3306)'
        }
      }, { status: 500 });
    }
    
    // 동적 import로 MySQL 클라이언트 로드
    let mysqlClient;
    try {
      mysqlClient = await import('@/lib/database/mysql-client');
    } catch (error) {
      console.log('MySQL 클라이언트 로드 실패:', error.message);
      return NextResponse.json({
        success: false,
        error: 'MySQL 클라이언트 로드 실패',
        message: 'MySQL 클라이언트를 초기화할 수 없습니다.',
        details: error.message,
        suggestion: 'mysql2 패키지가 설치되어 있는지 확인하세요: npm install mysql2'
      }, { status: 500 });
    }
    
    // MySQL 연결 테스트
    const isConnected = await mysqlClient.testMySQLConnection();
    
    if (!isConnected) {
      return NextResponse.json(
        { 
          success: false,
          error: 'MySQL 연결 실패',
          message: '데이터베이스에 연결할 수 없습니다.',
          envStatus: envVars,
          suggestions: [
            'MySQL 서버가 실행 중인지 확인하세요',
            '연결 정보(호스트, 포트, 사용자명, 비밀번호)가 올바른지 확인하세요',
            '데이터베이스가 존재하는지 확인하세요',
            '방화벽 설정을 확인하세요'
          ]
        },
        { status: 500 }
      );
    }

    // 기본 정보 조회
    let serverInfo = null;
    let databases = [];
    let tables = [];
    
    try {
      // 서버 버전 정보
      const versionResult = await mysqlClient.executeQuery('SELECT VERSION() as version');
      serverInfo = versionResult[0];
      
      // 데이터베이스 목록
      const dbResult = await mysqlClient.executeQuery('SHOW DATABASES');
      databases = dbResult.map(row => row.Database);
      
      // 현재 데이터베이스의 테이블 목록
      const tableResult = await mysqlClient.executeQuery('SHOW TABLES');
      const tableKey = `Tables_in_${envVars.database}`;
      tables = tableResult.map(row => row[tableKey]);
      
    } catch (error) {
      console.log('MySQL 정보 조회 실패:', error.message);
    }

    // MySQL 연결 정보
    const connectionInfo = mysqlClient.getMySQLInfo();

    return NextResponse.json({
      success: true,
      message: 'MySQL 연결 성공',
      connection: {
        ...connectionInfo,
        serverInfo,
        databases,
        tables,
        tableCount: tables.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MySQL 연결 테스트 실패:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'MySQL 연결 테스트 중 오류 발생',
        message: error.message,
        code: error.code,
        errno: error.errno,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 