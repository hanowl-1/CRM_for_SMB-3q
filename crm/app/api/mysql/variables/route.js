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

// 테이블별 변수 매핑 정의
const TABLE_VARIABLE_MAPPING = {
  Companies: {
    tableName: 'Companies',
    displayName: '회사 정보',
    variables: [
      { field: 'name', variable: '회사명', description: '회사 이름', example: '맛있는 한식당' },
      { field: 'email', variable: '회사이메일', description: '회사 이메일 주소', example: 'company@example.com' },
      { field: 'contacts', variable: '연락처', description: '회사 연락처', example: '010-1234-5678' },
      { field: 'charger', variable: '담당자', description: '담당자 이름', example: '김담당' },
      { field: 'manager', variable: '매니저', description: '매니저 이름', example: '박매니저' },
      { field: 'createdAt', variable: '가입일', description: '회사 가입일', example: '2024-01-15' },
      { field: 'last_login', variable: '최종로그인', description: '최종 로그인 일시', example: '2024-06-13 10:30:00' }
    ]
  },
  MarketingLead: {
    tableName: 'MarketingLead',
    displayName: '마케팅 리드',
    variables: [
      { field: 'companyName', variable: '리드회사명', description: '리드 회사 이름', example: '신규 카페' },
      { field: 'contact', variable: '리드연락처', description: '리드 연락처', example: '010-9876-5432' },
      { field: 'adCategory', variable: '광고카테고리', description: '광고 카테고리', example: '음식점' },
      { field: 'assignee', variable: '담당영업', description: '담당 영업사원', example: '이영업' },
      { field: 'callTemperature', variable: '콜온도', description: '영업 온도 (1-10)', example: '7' },
      { field: 'agreeToMarketing', variable: '마케팅동의', description: '마케팅 수신 동의 여부', example: 'true' },
      { field: 'kakaoRegistered', variable: '카카오등록', description: '카카오톡 등록 여부', example: 'false' },
      { field: 'createdAt', variable: '리드생성일', description: '리드 생성일', example: '2024-06-10' }
    ]
  },
  Ads: {
    tableName: 'Ads',
    displayName: '광고 정보',
    variables: [
      { field: 'name', variable: '광고명', description: '광고 이름', example: '맛집 체험단' },
      { field: 'companyName', variable: '광고회사명', description: '광고 회사명', example: '맛있는 카페' },
      { field: 'category', variable: '광고카테고리', description: '광고 카테고리', example: '음식점' },
      { field: 'address', variable: '주소', description: '매장 주소', example: '서울시 강남구' },
      { field: 'contacts', variable: '광고연락처', description: '광고 연락처', example: '010-1111-2222' },
      { field: 'email', variable: '광고이메일', description: '광고 이메일', example: 'ad@example.com' },
      { field: 'csNumber', variable: '고객센터번호', description: '고객센터 전화번호', example: '1588-1234' },
      { field: 'site', variable: '홈페이지', description: '회사 홈페이지', example: 'https://company.com' },
      { field: 'registerLink', variable: '신청링크', description: '체험단 신청 링크', example: 'https://apply.com' },
      { field: 'purchaseLink', variable: '구매링크', description: '제품 구매 링크', example: 'https://shop.com' },
      { field: 'introduction', variable: '광고소개', description: '광고 소개글', example: '맛있는 음식을 체험해보세요' },
      { field: 'requirement', variable: '신청조건', description: '체험단 신청 조건', example: '인스타그램 팔로워 1000명 이상' },
      { field: 'deadline', variable: '마감일수', description: '신청 마감까지 남은 일수', example: '7' },
      { field: 'lastContractDate', variable: '최종계약일', description: '최종 계약일', example: '2024-05-20' },
      { field: 'createdAt', variable: '광고등록일', description: '광고 등록일', example: '2024-06-01' },
      { field: 'step', variable: '광고단계', description: '광고 진행 단계', example: '1' },
      { field: 'verified', variable: '인증여부', description: '광고 인증 여부', example: 'true' },
      { field: 'type', variable: '광고유형', description: '광고 유형', example: '체험단' },
      { field: 'priority', variable: '우선순위', description: '광고 우선순위', example: '1' }
    ]
  },
  Contracts: {
    tableName: 'Contracts',
    displayName: '계약 정보',
    variables: [
      { field: 'user', variable: '계약자', description: '계약자 ID', example: 'user123' },
      { field: 'userEmail', variable: '계약자이메일', description: '계약자 이메일', example: 'user@example.com' },
      { field: 'companyName', variable: '계약회사명', description: '계약 회사명', example: '체험 카페' },
      { field: 'payPrice', variable: '결제금액', description: '결제 금액', example: '50000' },
      { field: 'deadline', variable: '마감일수', description: '마감까지 남은 일수', example: '7' },
      { field: 'createdAt', variable: '계약일', description: '계약 생성일', example: '2024-06-01' }
    ]
  },
  Channels: {
    tableName: 'Channels',
    displayName: '구독 채널 관리',
    variables: [
      { field: 'name', variable: '채널명', description: '구독 중인 인플루언서 채널명', example: '맛집 리뷰 채널' },
      { field: 'description', variable: '채널설명', description: '채널 소개 및 특징', example: '맛있는 음식점을 소개하는 인플루언서' },
      { field: 'category', variable: '채널카테고리', description: '채널 전문 분야', example: '음식점' },
      { field: 'followers', variable: '팔로워수', description: '인플루언서 팔로워 수', example: '15000' },
      { field: 'engagement', variable: '참여율', description: '게시물 참여율 (%)', example: '3.5' },
      { field: 'platform', variable: '플랫폼', description: '활동 소셜미디어 플랫폼', example: '인스타그램' },
      { field: 'contact', variable: '채널연락처', description: '인플루언서 연락처', example: '010-3333-4444' },
      { field: 'email', variable: '채널이메일', description: '인플루언서 이메일', example: 'influencer@example.com' },
      { field: 'available', variable: '구독상태', description: '광고주 구독 상태', example: '구독중' },
      { field: 'price', variable: '제공금액', description: '인플루언서 제공 금액', example: '100000' },
      { field: 'location', variable: '활동지역', description: '주요 활동 지역', example: '서울' },
      { field: 'createdAt', variable: '구독시작일', description: '구독 시작일', example: '2024-05-15' },
      { field: 'updatedAt', variable: '최종업데이트', description: '정보 최종 업데이트일', example: '2024-06-10' }
    ]
  }
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tableName = searchParams.get('table');
    const recordId = searchParams.get('id');
    const searchTerm = searchParams.get('term');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (action === 'tables') {
      // 사용 가능한 테이블 목록 반환
      return NextResponse.json({
        success: true,
        tables: Object.keys(TABLE_VARIABLE_MAPPING).map(key => ({
          tableName: key,
          displayName: TABLE_VARIABLE_MAPPING[key].displayName,
          variableCount: TABLE_VARIABLE_MAPPING[key].variables.length
        })),
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'variables' && tableName) {
      // 특정 테이블의 변수 목록 반환
      const tableConfig = TABLE_VARIABLE_MAPPING[tableName];
      if (!tableConfig) {
        return NextResponse.json({ 
          error: '지원하지 않는 테이블입니다' 
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        tableName,
        displayName: tableConfig.displayName,
        variables: tableConfig.variables,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'search' && tableName && searchTerm) {
      // 테이블에서 검색어로 데이터 검색
      const tableConfig = TABLE_VARIABLE_MAPPING[tableName];
      if (!tableConfig) {
        return NextResponse.json({ 
          error: '지원하지 않는 테이블입니다' 
        }, { status: 400 });
      }

      // 검색 가능한 필드들을 기반으로 동적 WHERE 조건 생성
      const searchableFields = tableConfig.variables
        .filter(v => ['name', 'email', 'contacts', 'companyName', 'contact'].includes(v.field))
        .map(v => v.field);

      if (searchableFields.length === 0) {
        return NextResponse.json({ 
          error: '검색 가능한 필드가 없습니다' 
        }, { status: 400 });
      }

      // WHERE 조건 생성 (OR로 연결)
      const whereConditions = searchableFields.map(field => `\`${field}\` LIKE ?`).join(' OR ');
      const searchValues = searchableFields.map(() => `%${searchTerm}%`);

      const [rows] = await pool.execute(`
        SELECT * FROM \`${tableName}\` 
        WHERE ${whereConditions}
        ORDER BY id DESC 
        LIMIT ?
      `, [...searchValues, limit]);

      return NextResponse.json({
        success: true,
        tableName,
        displayName: tableConfig.displayName,
        results: rows,
        count: rows.length,
        searchTerm,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'data' && tableName && recordId) {
      // 특정 레코드의 실제 데이터 반환
      const tableConfig = TABLE_VARIABLE_MAPPING[tableName];
      if (!tableConfig) {
        return NextResponse.json({ 
          error: '지원하지 않는 테이블입니다' 
        }, { status: 400 });
      }

      // 실제 데이터 조회
      const [rows] = await pool.execute(`
        SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1
      `, [recordId]);

      if (rows.length === 0) {
        return NextResponse.json({ 
          error: '해당 레코드를 찾을 수 없습니다' 
        }, { status: 404 });
      }

      const record = rows[0];
      const variables = {};

      // 변수 매핑에 따라 실제 값 추출
      tableConfig.variables.forEach(variable => {
        const value = record[variable.field];
        variables[variable.variable] = value !== null && value !== undefined ? String(value) : '';
      });

      return NextResponse.json({
        success: true,
        tableName,
        displayName: tableConfig.displayName,
        recordId,
        variables,
        rawData: record,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      error: '잘못된 요청입니다' 
    }, { status: 400 });

  } catch (error) {
    console.error('변수 API 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

// 레코드의 표시 텍스트 생성
function getDisplayText(record, tableConfig) {
  const nameField = tableConfig.variables.find(v => 
    v.field === 'name' || v.field === 'companyName'
  );
  
  if (nameField && record[nameField.field]) {
    return `${record[nameField.field]} (ID: ${record.id})`;
  }
  
  return `ID: ${record.id}`;
} 