import mysql from 'mysql2/promise';

// MySQL 연결 설정
const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'crm_smb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// 연결 풀 생성
let pool = null;

// MySQL 연결 풀 초기화
export function initMySQLPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(mysqlConfig);
      console.log('MySQL 연결 풀이 생성되었습니다.');
    } catch (error) {
      console.error('MySQL 연결 풀 생성 실패:', error);
      throw error;
    }
  }
  return pool;
}

// MySQL 연결 테스트
export async function testMySQLConnection() {
  try {
    console.log('MySQL 연결 시도 중...');
    console.log('연결 설정:', {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      database: mysqlConfig.database,
      hasPassword: !!mysqlConfig.password
    });
    
    const connection = await getMySQLConnection();
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('MySQL 연결 테스트 성공:', rows);
    connection.release();
    return true;
  } catch (error) {
    console.error('MySQL 연결 테스트 실패 - 상세 정보:');
    console.error('에러 코드:', error.code);
    console.error('에러 번호:', error.errno);
    console.error('SQL 상태:', error.sqlState);
    console.error('에러 메시지:', error.message);
    console.error('전체 에러:', error);
    return false;
  }
}

// MySQL 연결 가져오기
export async function getMySQLConnection() {
  if (!pool) {
    initMySQLPool();
  }
  
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('MySQL 연결 가져오기 실패:', error);
    throw error;
  }
}

// 쿼리 실행 헬퍼 함수
export async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await getMySQLConnection();
    const [rows] = await connection.execute(query, params);
    return rows;
  } catch (error) {
    console.error('쿼리 실행 실패:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// MySQL 정보 조회
export function getMySQLInfo() {
  return {
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    database: mysqlConfig.database,
    hasPassword: !!mysqlConfig.password,
    isPoolInitialized: !!pool
  };
}

export { pool }; 