import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MAPPINGS_FILE = path.join(process.cwd(), 'data', 'table-mappings.json');

// 기본 매핑 데이터
const DEFAULT_MAPPINGS = {
  Companies: {
    tableName: 'Companies',
    displayName: '회사 정보',
    description: '고객 회사 정보 및 담당자 데이터',
    icon: 'Building2',
    enabled: true,
    fields: {
      name: { displayName: '회사명', description: '회사 이름', type: 'text', filterable: true },
      email: { displayName: '회사이메일', description: '회사 대표 이메일', type: 'email', filterable: true },
      phone: { displayName: '연락처', description: '회사 대표 연락처', type: 'phone', filterable: true },
      manager: { displayName: '담당자', description: '회사 담당자 이름', type: 'text', filterable: true },
      sales_manager: { displayName: '매니저', description: '영업 담당 매니저', type: 'text', filterable: true },
      created_at: { displayName: '가입일', description: '회사 등록일', type: 'date', filterable: true },
      last_login: { displayName: '최종로그인', description: '마지막 로그인 시간', type: 'datetime', filterable: true }
    }
  },
  MarketingLead: {
    tableName: 'MarketingLead',
    displayName: '마케팅 리드',
    description: '마케팅을 통해 유입된 잠재 고객 정보',
    icon: 'Target',
    enabled: true,
    fields: {
      company_name: { displayName: '리드회사명', description: '리드 회사 이름', type: 'text', filterable: true },
      phone: { displayName: '리드연락처', description: '리드 연락처', type: 'phone', filterable: true },
      category: { displayName: '광고카테고리', description: '광고 카테고리', type: 'text', filterable: true },
      sales_person: { displayName: '담당영업', description: '담당 영업사원', type: 'text', filterable: true },
      call_temperature: { displayName: '콜온도', description: '영업 콜 온도', type: 'select', filterable: true },
      marketing_consent: { displayName: '마케팅동의', description: '마케팅 수신 동의 여부', type: 'boolean', filterable: true },
      kakao_registered: { displayName: '카카오등록', description: '카카오톡 등록 여부', type: 'boolean', filterable: true },
      created_at: { displayName: '리드생성일', description: '리드 생성일', type: 'date', filterable: true }
    }
  },
  Ads: {
    tableName: 'Ads',
    displayName: '광고 정보',
    description: '광고 캠페인 및 상품 정보',
    icon: 'Megaphone',
    enabled: true,
    fields: {
      title: { displayName: '광고명', description: '광고 제목', type: 'text', filterable: true },
      company_name: { displayName: '광고회사명', description: '광고주 회사명', type: 'text', filterable: true },
      category: { displayName: '광고카테고리', description: '광고 카테고리', type: 'text', filterable: true },
      address: { displayName: '주소', description: '회사 주소', type: 'text', filterable: false },
      phone: { displayName: '광고연락처', description: '광고 문의 연락처', type: 'phone', filterable: true },
      email: { displayName: '광고이메일', description: '광고 문의 이메일', type: 'email', filterable: true },
      customer_service: { displayName: '고객센터번호', description: '고객센터 연락처', type: 'phone', filterable: false },
      website: { displayName: '홈페이지', description: '회사 홈페이지 URL', type: 'url', filterable: false },
      apply_link: { displayName: '신청링크', description: '신청 페이지 링크', type: 'url', filterable: false },
      purchase_link: { displayName: '구매링크', description: '구매 페이지 링크', type: 'url', filterable: false },
      description: { displayName: '광고소개', description: '광고 상세 설명', type: 'text', filterable: false },
      requirements: { displayName: '신청조건', description: '신청 자격 조건', type: 'text', filterable: false },
      days_until_deadline: { displayName: '마감일수', description: '마감까지 남은 일수', type: 'number', filterable: true },
      last_contract_date: { displayName: '최종계약일', description: '마지막 계약 체결일', type: 'date', filterable: true },
      created_at: { displayName: '광고등록일', description: '광고 등록일', type: 'date', filterable: true },
      stage: { displayName: '광고단계', description: '광고 진행 단계', type: 'select', filterable: true },
      is_verified: { displayName: '인증여부', description: '광고 인증 상태', type: 'boolean', filterable: true },
      ad_type: { displayName: '광고유형', description: '광고 유형 분류', type: 'select', filterable: true },
      priority: { displayName: '우선순위', description: '광고 우선순위', type: 'number', filterable: true }
    }
  },
  Contracts: {
    tableName: 'Contracts',
    displayName: '계약 정보',
    description: '고객과의 계약 및 결제 정보',
    icon: 'FileText',
    enabled: true,
    fields: {
      contractor_name: { displayName: '계약자', description: '계약자 이름', type: 'text', filterable: true },
      contractor_email: { displayName: '계약자이메일', description: '계약자 이메일', type: 'email', filterable: true },
      company_name: { displayName: '계약회사명', description: '계약 회사명', type: 'text', filterable: true },
      payment_amount: { displayName: '결제금액', description: '계약 결제 금액', type: 'number', filterable: true },
      days_until_deadline: { displayName: '마감일수', description: '계약 마감까지 남은 일수', type: 'number', filterable: true },
      created_at: { displayName: '계약일', description: '계약 체결일', type: 'date', filterable: true }
    }
  },
  Channels: {
    tableName: 'Channels',
    displayName: '채널 정보',
    description: '인플루언서 채널 및 구독 정보',
    icon: 'Radio',
    enabled: true,
    fields: {
      channel_name: { displayName: '채널명', description: '채널 이름', type: 'text', filterable: true },
      description: { displayName: '채널설명', description: '채널 설명', type: 'text', filterable: false },
      category: { displayName: '채널카테고리', description: '채널 카테고리', type: 'text', filterable: true },
      followers: { displayName: '팔로워수', description: '팔로워 수', type: 'number', filterable: true },
      engagement_rate: { displayName: '참여율', description: '채널 참여율', type: 'number', filterable: true },
      platform: { displayName: '플랫폼', description: '채널 플랫폼', type: 'select', filterable: true },
      subscription_status: { displayName: '구독상태', description: '구독 상태', type: 'select', filterable: true },
      monthly_fee: { displayName: '월구독료', description: '월 구독료', type: 'number', filterable: true },
      subscriber_count: { displayName: '구독자수', description: '구독자 수', type: 'number', filterable: true },
      content_type: { displayName: '콘텐츠유형', description: '주요 콘텐츠 유형', type: 'select', filterable: true },
      rating: { displayName: '평점', description: '채널 평점', type: 'number', filterable: true },
      is_verified: { displayName: '인증여부', description: '채널 인증 상태', type: 'boolean', filterable: true },
      created_at: { displayName: '채널생성일', description: '채널 생성일', type: 'date', filterable: true }
    }
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

// 매핑 데이터 로드
async function loadMappings() {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(MAPPINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 파일이 없으면 기본 매핑 반환
    return DEFAULT_MAPPINGS;
  }
}

// 매핑 데이터 저장
async function saveMappings(mappings) {
  await ensureDataDirectory();
  await fs.writeFile(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

export async function GET() {
  try {
    const mappings = await loadMappings();
    
    return NextResponse.json({
      success: true,
      mappings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('매핑 데이터 로드 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, tableName, mapping } = body;

    const mappings = await loadMappings();

    if (action === 'save') {
      if (!tableName || !mapping) {
        return NextResponse.json({ 
          error: 'tableName과 mapping이 필요합니다.' 
        }, { status: 400 });
      }

      mappings[tableName] = {
        ...mapping,
        updatedAt: new Date().toISOString()
      };

      await saveMappings(mappings);

      return NextResponse.json({
        success: true,
        message: `${tableName} 매핑이 저장되었습니다.`,
        mapping: mappings[tableName]
      });
    }

    if (action === 'delete') {
      if (!tableName) {
        return NextResponse.json({ 
          error: 'tableName이 필요합니다.' 
        }, { status: 400 });
      }

      delete mappings[tableName];
      await saveMappings(mappings);

      return NextResponse.json({
        success: true,
        message: `${tableName} 매핑이 삭제되었습니다.`
      });
    }

    if (action === 'toggle') {
      if (!tableName) {
        return NextResponse.json({ 
          error: 'tableName이 필요합니다.' 
        }, { status: 400 });
      }

      if (mappings[tableName]) {
        mappings[tableName].enabled = !mappings[tableName].enabled;
        mappings[tableName].updatedAt = new Date().toISOString();
        await saveMappings(mappings);

        return NextResponse.json({
          success: true,
          message: `${tableName} 매핑이 ${mappings[tableName].enabled ? '활성화' : '비활성화'}되었습니다.`,
          enabled: mappings[tableName].enabled
        });
      }
    }

    return NextResponse.json({ 
      error: '잘못된 액션입니다.' 
    }, { status: 400 });

  } catch (error) {
    console.error('매핑 데이터 처리 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
} 