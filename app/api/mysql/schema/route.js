import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'supermembers-prod.cluster-cy8cnze5wxti.ap-northeast-2.rds.amazonaws.com',
  port: 3306,
  user: 'readonly',
  password: 'phozphoz1!',
  database: 'supermembers',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tableName = searchParams.get('table');

    if (action === 'tables') {
      // 모든 테이블 목록 조회
      const [tables] = await pool.execute(`
        SELECT 
          TABLE_NAME as tableName,
          TABLE_COMMENT as tableComment,
          TABLE_ROWS as estimatedRows,
          CREATE_TIME as createdAt,
          UPDATE_TIME as updatedAt
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'supermembers' 
        AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);

      return NextResponse.json({
        success: true,
        tables: tables,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'columns' && tableName) {
      // 특정 테이블의 컬럼 정보 조회
      const [columns] = await pool.execute(`
        SELECT 
          COLUMN_NAME as columnName,
          DATA_TYPE as dataType,
          IS_NULLABLE as isNullable,
          COLUMN_DEFAULT as defaultValue,
          COLUMN_COMMENT as columnComment,
          CHARACTER_MAXIMUM_LENGTH as maxLength,
          NUMERIC_PRECISION as numericPrecision,
          NUMERIC_SCALE as numericScale,
          COLUMN_KEY as columnKey,
          EXTRA as extra
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'supermembers' 
        AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);

      // 샘플 데이터도 함께 조회 (최대 3개)
      let sampleData = [];
      try {
        const [samples] = await pool.execute(`
          SELECT * FROM \`${tableName}\` 
          WHERE id IS NOT NULL 
          ORDER BY id DESC 
          LIMIT 3
        `);
        sampleData = samples;
      } catch (sampleError) {
        console.warn('샘플 데이터 조회 실패:', sampleError.message);
      }

      return NextResponse.json({
        success: true,
        tableName,
        columns: columns,
        sampleData: sampleData,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'sample' && tableName) {
      // 특정 테이블의 샘플 데이터만 조회
      const limit = parseInt(searchParams.get('limit') || '10');
      
      const [sampleData] = await pool.execute(`
        SELECT * FROM \`${tableName}\` 
        WHERE id IS NOT NULL 
        ORDER BY id DESC 
        LIMIT ?
      `, [limit]);

      return NextResponse.json({
        success: true,
        tableName,
        sampleData: sampleData,
        count: sampleData.length,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      error: '잘못된 요청입니다. action 파라미터를 확인하세요.' 
    }, { status: 400 });

  } catch (error) {
    console.error('MySQL 스키마 조회 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 