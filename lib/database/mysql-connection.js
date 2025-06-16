const mysql = require('mysql2/promise');

// MySQL Readonly 연결 설정
const mysqlConfig = {
  host: process.env.MYSQL_READONLY_HOST || 'supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com',
  port: parseInt(process.env.MYSQL_READONLY_PORT) || 3306,
  user: process.env.MYSQL_READONLY_USER || 'readonly',
  password: process.env.MYSQL_READONLY_PASSWORD || 'phozphoz1!',
  database: process.env.MYSQL_READONLY_DATABASE || 'supermembers',
  charset: 'utf8mb4',
  timezone: '+09:00', // 한국 시간대
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  // 연결 풀 설정
  connectionLimit: 10,
  queueLimit: 0,
  // SSL 설정 (AWS RDS의 경우 필요할 수 있음)
  ssl: {
    rejectUnauthorized: false
  }
};

// 디버깅을 위한 설정 로그
console.log('MySQL 연결 설정:', {
  host: mysqlConfig.host,
  port: mysqlConfig.port,
  user: mysqlConfig.user,
  database: mysqlConfig.database,
  hasPassword: !!mysqlConfig.password
});

// 연결 풀 생성
const pool = mysql.createPool(mysqlConfig);

// 단일 연결 생성 함수
async function createConnection() {
  try {
    console.log('단일 MySQL 연결 시도 중...');
    const connection = await mysql.createConnection(mysqlConfig);
    console.log('MySQL readonly 연결 성공');
    return connection;
  } catch (error) {
    console.error('MySQL 연결 실패:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState
    });
    throw error;
  }
}

// 쿼리 실행 함수 (풀 사용)
async function executeQuery(sql, params = []) {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('쿼리 실행 실패:', {
      sql,
      params,
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

// 트랜잭션 실행 함수 (readonly이므로 SELECT만 가능)
async function executeTransaction(queries) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { sql, params } of queries) {
      const [rows] = await connection.execute(sql, params);
      results.push(rows);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 연결 테스트 함수
async function testConnection() {
  try {
    console.log('MySQL 연결 테스트 시작...');
    const result = await executeQuery('SELECT 1 as test');
    console.log('MySQL 연결 테스트 성공:', result);
    return true;
  } catch (error) {
    console.error('MySQL 연결 테스트 실패:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      fatal: error.fatal
    });
    return false;
  }
}

// 데이터베이스 정보 조회
async function getDatabaseInfo() {
  try {
    const tables = await executeQuery('SHOW TABLES');
    const version = await executeQuery('SELECT VERSION() as version');
    const currentUser = await executeQuery('SELECT USER() as current_user');
    
    return {
      version: version[0].version,
      currentUser: currentUser[0].current_user,
      tables: tables.map(table => Object.values(table)[0])
    };
  } catch (error) {
    console.error('데이터베이스 정보 조회 실패:', error);
    throw error;
  }
}

// 연결 종료
async function closeConnection() {
  try {
    await pool.end();
    console.log('MySQL 연결 풀 종료');
  } catch (error) {
    console.error('연결 종료 실패:', error);
  }
}

module.exports = {
  pool,
  createConnection,
  executeQuery,
  executeTransaction,
  testConnection,
  getDatabaseInfo,
  closeConnection
}; 