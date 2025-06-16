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

// 기존 API를 새로운 Supabase 기반 API로 리디렉션
export async function GET(request) {
  const url = new URL(request.url);
  const newUrl = url.toString().replace('/api/mysql/custom-queries', '/api/supabase/custom-queries');
  
  return NextResponse.redirect(newUrl, 301);
}

export async function POST(request) {
  const url = new URL(request.url);
  const newUrl = url.toString().replace('/api/mysql/custom-queries', '/api/supabase/custom-queries');
  
  // POST 요청은 리디렉션이 복잡하므로 직접 프록시
  try {
    const body = await request.json();
    
    const response = await fetch(newUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '새로운 API로 요청 전달 중 오류가 발생했습니다.',
      message: 'API가 Supabase 기반으로 이전되었습니다. /api/supabase/custom-queries를 사용해주세요.'
    }, { status: 500 });
  }
} 