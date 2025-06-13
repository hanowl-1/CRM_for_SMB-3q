import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

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

const CUSTOM_QUERIES_FILE = path.join(process.cwd(), 'data', 'custom-queries.json');

// 기본 커스텀 쿼리 예시
const DEFAULT_CUSTOM_QUERIES = {
  "subscription_contacts": {
    queryName: "subscription_contacts",
    displayName: "구독중인 가맹점 연락처",
    description: "구독중인 가맹점의 연락처 정보를 추출",
    query: `SELECT 
      Companies.id AS company_id,
      Companies.name AS company_name,
      Companies.contacts AS contact_info,
      Companies.email AS company_email,
      Channels.available AS channel_available,
      Channels.name AS channel_name,
      Ads.name AS ad_name,
      Ads.category AS ad_category
    FROM Companies
    JOIN Ads ON Ads.companyId = Companies.id
    JOIN Channels ON Channels.adid = Ads.id
    WHERE Channels.available = '구독중'`,
    variables: [
      { field: 'company_id', variable: '회사ID', description: '회사 고유 ID', type: 'number' },
      { field: 'company_name', variable: '회사명', description: '회사 이름', type: 'text' },
      { field: 'contact_info', variable: '연락처', description: '회사 연락처', type: 'phone' },
      { field: 'company_email', variable: '회사이메일', description: '회사 이메일', type: 'email' },
      { field: 'channel_available', variable: '구독상태', description: '채널 구독 상태', type: 'text' },
      { field: 'channel_name', variable: '채널명', description: '구독 채널명', type: 'text' },
      { field: 'ad_name', variable: '광고명', description: '관련 광고명', type: 'text' },
      { field: 'ad_category', variable: '광고카테고리', description: '광고 카테고리', type: 'text' }
    ],
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

// 데이터 디렉토리 확인 및 생성
async function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// 커스텀 쿼리 데이터 로드
async function loadCustomQueries() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(CUSTOM_QUERIES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 파일이 없으면 기본 쿼리 반환
    return DEFAULT_CUSTOM_QUERIES;
  }
}

// 커스텀 쿼리 데이터 저장
async function saveCustomQueries(queries) {
  await ensureDataDirectory();
  await fs.writeFile(CUSTOM_QUERIES_FILE, JSON.stringify(queries, null, 2));
}

// SQL 쿼리 검증 (기본적인 보안 체크)
function validateQuery(query) {
  const dangerousKeywords = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE',
    'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL'
  ];
  
  const upperQuery = query.toUpperCase();
  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      throw new Error(`보안상 ${keyword} 명령어는 사용할 수 없습니다.`);
    }
  }
  
  // SELECT 문만 허용
  if (!upperQuery.trim().startsWith('SELECT')) {
    throw new Error('SELECT 문만 허용됩니다.');
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const queryName = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (action === 'list') {
      // 모든 커스텀 쿼리 목록 반환
      const queries = await loadCustomQueries();
      
      return NextResponse.json({
        success: true,
        queries: Object.values(queries).map(q => ({
          queryName: q.queryName,
          displayName: q.displayName,
          description: q.description,
          variableCount: q.variables?.length || 0,
          enabled: q.enabled,
          updatedAt: q.updatedAt
        })),
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get' && queryName) {
      // 특정 커스텀 쿼리 정보 반환
      const queries = await loadCustomQueries();
      const query = queries[queryName];
      
      if (!query) {
        return NextResponse.json({ 
          error: '해당 쿼리를 찾을 수 없습니다.' 
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        query,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'execute' && queryName) {
      // 커스텀 쿼리 실행
      const queries = await loadCustomQueries();
      const queryConfig = queries[queryName];
      
      if (!queryConfig || !queryConfig.enabled) {
        return NextResponse.json({ 
          error: '해당 쿼리를 찾을 수 없거나 비활성화되어 있습니다.' 
        }, { status: 404 });
      }

      // 쿼리 실행
      const [results] = await pool.execute(`${queryConfig.query} LIMIT ?`, [limit]);

      return NextResponse.json({
        success: true,
        queryName,
        displayName: queryConfig.displayName,
        results,
        variables: queryConfig.variables,
        count: results.length,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'test' && queryName) {
      // 쿼리 테스트 실행 (최대 3개 결과만)
      const queries = await loadCustomQueries();
      const queryConfig = queries[queryName];
      
      if (!queryConfig) {
        return NextResponse.json({ 
          error: '해당 쿼리를 찾을 수 없습니다.' 
        }, { status: 404 });
      }

      try {
        validateQuery(queryConfig.query);
        const [results] = await pool.execute(`${queryConfig.query} LIMIT 3`);

        return NextResponse.json({
          success: true,
          queryName,
          testResults: results,
          variables: queryConfig.variables,
          count: results.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('커스텀 쿼리 처리 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, queryName, queryConfig } = body;

    const queries = await loadCustomQueries();

    if (action === 'save') {
      if (!queryName || !queryConfig) {
        return NextResponse.json({ 
          error: 'queryName과 queryConfig가 필요합니다.' 
        }, { status: 400 });
      }

      // 쿼리 검증
      validateQuery(queryConfig.query);

      queries[queryName] = {
        ...queryConfig,
        queryName,
        updatedAt: new Date().toISOString(),
        createdAt: queries[queryName]?.createdAt || new Date().toISOString()
      };

      await saveCustomQueries(queries);

      return NextResponse.json({
        success: true,
        message: `${queryName} 쿼리가 저장되었습니다.`,
        query: queries[queryName]
      });
    }

    if (action === 'delete') {
      if (!queryName) {
        return NextResponse.json({ 
          error: 'queryName이 필요합니다.' 
        }, { status: 400 });
      }

      delete queries[queryName];
      await saveCustomQueries(queries);

      return NextResponse.json({
        success: true,
        message: `${queryName} 쿼리가 삭제되었습니다.`
      });
    }

    if (action === 'toggle') {
      if (!queryName) {
        return NextResponse.json({ 
          error: 'queryName이 필요합니다.' 
        }, { status: 400 });
      }

      if (queries[queryName]) {
        queries[queryName].enabled = !queries[queryName].enabled;
        queries[queryName].updatedAt = new Date().toISOString();
        await saveCustomQueries(queries);

        return NextResponse.json({
          success: true,
          message: `${queryName} 쿼리가 ${queries[queryName].enabled ? '활성화' : '비활성화'}되었습니다.`,
          enabled: queries[queryName].enabled
        });
      }
    }

    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('커스텀 쿼리 저장 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
} 