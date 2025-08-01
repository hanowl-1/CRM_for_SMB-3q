/**
 * 🗄️ 데이터베이스 설정 중앙 관리
 * 
 * 모든 MySQL 연결 설정을 한 곳에서 관리합니다.
 * 환경별 설정과 연결 풀 옵션을 제공합니다.
 */

import mysql from 'mysql2/promise';

// 🔧 MySQL 연결 설정 (읽기 전용)
export const MYSQL_READONLY_CONFIG = {
  host: process.env.MYSQL_READONLY_HOST || 'supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com',
  port: parseInt(process.env.MYSQL_READONLY_PORT || '3306'),
  user: process.env.MYSQL_READONLY_USER || 'readonly',
  password: process.env.MYSQL_READONLY_PASSWORD || 'phozphoz1!',
  database: process.env.MYSQL_READONLY_DATABASE || 'supermembers',
  charset: 'utf8mb4',
  timezone: '+09:00',
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

// 🔧 MySQL 연결 설정 (일반)
export const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'crm_database',
  charset: 'utf8mb4',
  timezone: '+09:00',
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

// 🏊‍♂️ 연결 풀 설정
export const createMySQLPool = (config = MYSQL_READONLY_CONFIG) => {
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
};

// 🔗 단일 연결 생성
export const createMySQLConnection = async (config = MYSQL_CONFIG) => {
  return await mysql.createConnection(config);
};

// 🎯 연결 테스트 헬퍼
export const testMySQLConnection = async (config = MYSQL_CONFIG) => {
  try {
    const connection = await createMySQLConnection(config);
    await connection.ping();
    await connection.end();
    return { success: true, message: 'MySQL 연결 성공' };
  } catch (error) {
    return { 
      success: false, 
      message: `MySQL 연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}` 
    };
  }
};

// 🏗️ 기본 연결 풀 (읽기 전용)
export const defaultPool = createMySQLPool(MYSQL_READONLY_CONFIG); 