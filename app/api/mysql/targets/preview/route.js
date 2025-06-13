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

export async function POST(request) {
  try {
    const { table, conditions } = await request.json();

    if (!table) {
      return NextResponse.json({ 
        error: 'table 파라미터가 필요합니다' 
      }, { status: 400 });
    }

    // 기본 쿼리 구성
    let query = `SELECT * FROM \`${table}\``;
    let whereConditions = [];
    
    // 조건들을 SQL WHERE 절로 변환
    if (conditions && conditions.length > 0) {
      conditions.forEach(condition => {
        if (condition.field && condition.operator && condition.value) {
          const escapedValue = condition.value.replace(/'/g, "''");
          
          switch (condition.operator) {
            case 'equals':
              whereConditions.push(`\`${condition.field}\` = '${escapedValue}'`);
              break;
            case 'contains':
              whereConditions.push(`\`${condition.field}\` LIKE '%${escapedValue}%'`);
              break;
            case 'greater_than':
              whereConditions.push(`\`${condition.field}\` > '${escapedValue}'`);
              break;
            case 'less_than':
              whereConditions.push(`\`${condition.field}\` < '${escapedValue}'`);
              break;
            case 'in_list':
              const values = escapedValue.split(',').map(v => `'${v.trim()}'`).join(',');
              whereConditions.push(`\`${condition.field}\` IN (${values})`);
              break;
          }
        }
      });
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // 전체 개수 조회
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    console.log('Count Query:', countQuery);
    
    const [countResult] = await pool.execute(countQuery);
    const totalCount = countResult[0].total;

    // 미리보기용 데이터 조회 (최대 10개)
    const previewQuery = `${query} ORDER BY id DESC LIMIT 10`;
    console.log('Preview Query:', previewQuery);
    
    const [previewResult] = await pool.execute(previewQuery);

    return NextResponse.json({
      success: true,
      count: totalCount,
      preview: previewResult,
      query: previewQuery,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('대상 미리보기 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 