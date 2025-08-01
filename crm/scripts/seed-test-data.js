#!/usr/bin/env node

// Supabase 테스트 데이터 생성 스크립트
const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const path = require('path');

// 환경변수 로드 (.env.local 파일 명시적 지정)
config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 환경변수 확인:');
console.log('   URL:', supabaseUrl ? '✅ 설정됨' : '❌ 없음');
console.log('   Key:', supabaseServiceKey ? '✅ 설정됨' : '❌ 없음');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.log('💡 .env.local 파일을 확인해주세요.');
  console.log('📁 현재 작업 디렉토리:', process.cwd());
  console.log('📁 .env.local 경로:', path.join(__dirname, '..', '.env.local'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 테스트 데이터 생성 함수들
const generateTestData = {
  // 1. 회사 데이터
  companies: [
    {
      email: 'contact@beautysalon.co.kr',
      name: '뷰티살롱 미라클',
      charger: '김미영',
      contacts: '010-1234-5678',
      is_active: 1,
      createdAt: new Date('2024-01-15').toISOString(),
      updatedAt: new Date('2024-01-15').toISOString(),
      memo: '강남 지역 프리미엄 뷰티살롱'
    },
    {
      email: 'info@restaurant-delicious.com',
      name: '맛있는 한식당',
      charger: '박요리',
      contacts: '010-2345-6789',
      is_active: 1,
      createdAt: new Date('2024-02-01').toISOString(),
      updatedAt: new Date('2024-02-01').toISOString(),
      memo: '전통 한식 전문점'
    },
    {
      email: 'hello@fitnessgym.kr',
      name: '헬스클럽 스트롱',
      charger: '이근육',
      contacts: '010-3456-7890',
      is_active: 1,
      createdAt: new Date('2024-02-15').toISOString(),
      updatedAt: new Date('2024-02-15').toISOString(),
      memo: '24시간 운영 헬스장'
    },
    {
      email: 'contact@cafebean.co.kr',
      name: '카페 원두향',
      charger: '최커피',
      contacts: '010-4567-8901',
      is_active: 1,
      createdAt: new Date('2024-03-01').toISOString(),
      updatedAt: new Date('2024-03-01').toISOString(),
      memo: '스페셜티 커피 전문점'
    },
    {
      email: 'admin@petshop.com',
      name: '펫샵 멍냥이',
      charger: '강애견',
      contacts: '010-5678-9012',
      is_active: 1,
      createdAt: new Date('2024-03-15').toISOString(),
      updatedAt: new Date('2024-03-15').toISOString(),
      memo: '반려동물 용품 전문점'
    }
  ],

  // 2. 사용자 데이터
  users: [
    {
      uid: 'user001',
      email: 'blogger1@naver.com',
      displayName: '블로거김씨',
      phone: '010-1111-2222',
      level: 'GOLD',
      type: 'BLOGGER',
      agreement: true,
      signupAt: new Date('2024-01-10').toISOString(),
      lastLogin: new Date('2024-06-10').toISOString(),
      updatedAt: new Date('2024-06-10').toISOString()
    },
    {
      uid: 'user002',
      email: 'influencer@instagram.com',
      displayName: '인플루언서박',
      phone: '010-2222-3333',
      level: 'DIAMOND',
      type: 'INFLUENCER',
      agreement: true,
      signupAt: new Date('2024-01-20').toISOString(),
      lastLogin: new Date('2024-06-11').toISOString(),
      updatedAt: new Date('2024-06-11').toISOString()
    },
    {
      uid: 'user003',
      email: 'reviewer@youtube.com',
      displayName: '리뷰어이씨',
      phone: '010-3333-4444',
      level: 'SILVER',
      type: 'REVIEWER',
      agreement: true,
      signupAt: new Date('2024-02-01').toISOString(),
      lastLogin: new Date('2024-06-09').toISOString(),
      updatedAt: new Date('2024-06-09').toISOString()
    }
  ],

  // 3. 키워드 데이터
  keywords: [
    {
      name: '뷰티살롱',
      cat1: '뷰티',
      cat2: '헤어',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      difficulty: 7.5,
      efficiency: 8.2
    },
    {
      name: '한식당',
      cat1: '음식',
      cat2: '한식',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      difficulty: 6.8,
      efficiency: 7.9
    },
    {
      name: '헬스장',
      cat1: '운동',
      cat2: '피트니스',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      difficulty: 8.1,
      efficiency: 7.5
    },
    {
      name: '카페',
      cat1: '음료',
      cat2: '커피',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      difficulty: 9.2,
      efficiency: 6.8
    },
    {
      name: '펫샵',
      cat1: '반려동물',
      cat2: '용품',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      difficulty: 5.9,
      efficiency: 8.7
    }
  ]
};

// 데이터 삽입 함수
async function seedDatabase() {
  console.log('🌱 Supabase 테스트 데이터 생성 시작...\n');

  try {
    // 1. 회사 데이터 삽입
    console.log('📊 회사 데이터 삽입 중...');
    const { data: companies, error: companiesError } = await supabase
      .from('Companies')
      .insert(generateTestData.companies)
      .select();

    if (companiesError) {
      console.error('❌ 회사 데이터 삽입 실패:', companiesError);
    } else {
      console.log(`✅ 회사 데이터 ${companies.length}개 삽입 완료`);
    }

    // 2. 사용자 데이터 삽입
    console.log('👥 사용자 데이터 삽입 중...');
    const { data: users, error: usersError } = await supabase
      .from('Users')
      .insert(generateTestData.users)
      .select();

    if (usersError) {
      console.error('❌ 사용자 데이터 삽입 실패:', usersError);
    } else {
      console.log(`✅ 사용자 데이터 ${users.length}개 삽입 완료`);
    }

    // 3. 키워드 데이터 삽입
    console.log('🔑 키워드 데이터 삽입 중...');
    const { data: keywords, error: keywordsError } = await supabase
      .from('Keywords')
      .insert(generateTestData.keywords)
      .select();

    if (keywordsError) {
      console.error('❌ 키워드 데이터 삽입 실패:', keywordsError);
    } else {
      console.log(`✅ 키워드 데이터 ${keywords.length}개 삽입 완료`);
    }

    // 4. 광고 데이터 생성 (회사 ID 필요)
    if (companies && companies.length > 0) {
      console.log('📢 광고 데이터 삽입 중...');
      
      const adsData = [
        {
          companyId: companies[0].id,
          name: '뷰티살롱 미라클 - 헤어컷 체험단',
          category: '뷰티/헤어',
          verified: true,
          createdAt: new Date('2024-04-01').toISOString(),
          updatedAt: new Date('2024-04-01').toISOString(),
          address: '서울시 강남구 테헤란로 123',
          keywords: '뷰티살롱, 헤어컷, 강남',
          memo: '프리미엄 헤어컷 체험단 모집'
        },
        {
          companyId: companies[1].id,
          name: '맛있는 한식당 - 정통 한정식 리뷰',
          category: '음식/한식',
          verified: true,
          createdAt: new Date('2024-04-15').toISOString(),
          updatedAt: new Date('2024-04-15').toISOString(),
          address: '서울시 종로구 인사동길 456',
          keywords: '한식당, 한정식, 인사동',
          memo: '전통 한정식 맛집 리뷰어 모집'
        },
        {
          companyId: companies[2].id,
          name: '헬스클럽 스트롱 - PT 체험 후기',
          category: '운동/피트니스',
          verified: false,
          createdAt: new Date('2024-05-01').toISOString(),
          updatedAt: new Date('2024-05-01').toISOString(),
          address: '서울시 마포구 홍대입구역 789',
          keywords: '헬스장, PT, 홍대',
          memo: '개인 트레이닝 체험 후기 작성'
        }
      ];

      const { data: ads, error: adsError } = await supabase
        .from('Ads')
        .insert(adsData)
        .select();

      if (adsError) {
        console.error('❌ 광고 데이터 삽입 실패:', adsError);
      } else {
        console.log(`✅ 광고 데이터 ${ads.length}개 삽입 완료`);

        // 5. 계약 데이터 생성 (광고 ID 필요)
        if (ads && ads.length > 0) {
          console.log('📋 계약 데이터 삽입 중...');
          
          const contractsData = [
            {
              id: 'contract_001',
              company: ads[0].id,
              companyName: '뷰티살롱 미라클',
              currentState: 2,
              user: 'user001',
              userEmail: 'blogger1@naver.com',
              createdAt: new Date('2024-04-02').toISOString(),
              updatedAt: new Date('2024-04-02').toISOString(),
              payPrice: 50000,
              type: 'BLOG_REVIEW'
            },
            {
              id: 'contract_002',
              company: ads[1].id,
              companyName: '맛있는 한식당',
              currentState: 1,
              user: 'user002',
              userEmail: 'influencer@instagram.com',
              createdAt: new Date('2024-04-16').toISOString(),
              updatedAt: new Date('2024-04-16').toISOString(),
              payPrice: 80000,
              type: 'INSTAGRAM_POST'
            },
            {
              id: 'contract_003',
              company: ads[2].id,
              companyName: '헬스클럽 스트롱',
              currentState: 0,
              user: 'user003',
              userEmail: 'reviewer@youtube.com',
              createdAt: new Date('2024-05-02').toISOString(),
              updatedAt: new Date('2024-05-02').toISOString(),
              payPrice: 120000,
              type: 'YOUTUBE_REVIEW'
            }
          ];

          const { data: contracts, error: contractsError } = await supabase
            .from('Contracts')
            .insert(contractsData)
            .select();

          if (contractsError) {
            console.error('❌ 계약 데이터 삽입 실패:', contractsError);
          } else {
            console.log(`✅ 계약 데이터 ${contracts.length}개 삽입 완료`);
          }
        }
      }
    }

    // 6. 문의사항 데이터 삽입
    console.log('💬 문의사항 데이터 삽입 중...');
    const inquiriesData = [
      {
        uid: 'user001',
        category: '결제 문의',
        subCategory: '결제 오류',
        contentText: '결제가 정상적으로 처리되지 않았습니다. 확인 부탁드립니다.',
        isAnswered: false,
        createdAt: new Date('2024-06-01').toISOString()
      },
      {
        uid: 'user002',
        category: '광고 문의',
        subCategory: '광고 승인',
        contentText: '광고 승인이 지연되고 있는 것 같습니다. 언제쯤 승인될까요?',
        isAnswered: true,
        answeredAt: new Date('2024-06-02').toISOString(),
        createdAt: new Date('2024-06-01').toISOString()
      }
    ];

    const { data: inquiries, error: inquiriesError } = await supabase
      .from('App_Inquiry')
      .insert(inquiriesData)
      .select();

    if (inquiriesError) {
      console.error('❌ 문의사항 데이터 삽입 실패:', inquiriesError);
    } else {
      console.log(`✅ 문의사항 데이터 ${inquiries.length}개 삽입 완료`);
    }

    console.log('\n🎉 테스트 데이터 생성 완료!');
    console.log('\n📊 생성된 데이터 요약:');
    console.log(`   - 회사: ${companies?.length || 0}개`);
    console.log(`   - 사용자: ${users?.length || 0}개`);
    console.log(`   - 키워드: ${keywords?.length || 0}개`);
    console.log(`   - 광고: ${companies ? 3 : 0}개`);
    console.log(`   - 계약: ${companies ? 3 : 0}개`);
    console.log(`   - 문의사항: ${inquiries?.length || 0}개`);

    console.log('\n🔗 다음 단계:');
    console.log('   - http://localhost:3001/api/supabase/test 에서 데이터 확인');
    console.log('   - Supabase 대시보드에서 테이블 데이터 확인');

  } catch (error) {
    console.error('❌ 테스트 데이터 생성 중 오류 발생:', error);
  }
}

// 스크립트 실행
seedDatabase(); 