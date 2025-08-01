#!/usr/bin/env node

// Supabase 테스트 데이터 생성 스크립트 (RLS 우회 버전)
const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
const path = require('path');

// 환경변수 로드
config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 환경변수 확인:');
console.log('   URL:', supabaseUrl ? '✅ 설정됨' : '❌ 없음');
console.log('   Key:', supabaseServiceKey ? '✅ 설정됨' : '❌ 없음');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SQL을 통한 직접 데이터 삽입 (RLS 우회)
async function seedDatabaseWithSQL() {
  console.log('🌱 Supabase 테스트 데이터 생성 시작 (SQL 방식)...\n');

  try {
    // 1. 회사 데이터 삽입
    console.log('📊 회사 데이터 삽입 중...');
    const companiesSQL = `
      INSERT INTO "Companies" (email, name, charger, contacts, is_active, "createdAt", "updatedAt", memo)
      VALUES 
        ('contact@beautysalon.co.kr', '뷰티살롱 미라클', '김미영', '010-1234-5678', 1, NOW(), NOW(), '강남 지역 프리미엄 뷰티살롱'),
        ('info@restaurant-delicious.com', '맛있는 한식당', '박요리', '010-2345-6789', 1, NOW(), NOW(), '전통 한식 전문점'),
        ('hello@fitnessgym.kr', '헬스클럽 스트롱', '이근육', '010-3456-7890', 1, NOW(), NOW(), '24시간 운영 헬스장'),
        ('contact@cafebean.co.kr', '카페 원두향', '최커피', '010-4567-8901', 1, NOW(), NOW(), '스페셜티 커피 전문점'),
        ('admin@petshop.com', '펫샵 멍냥이', '강애견', '010-5678-9012', 1, NOW(), NOW(), '반려동물 용품 전문점')
      ON CONFLICT (email) DO NOTHING;
    `;

    const { error: companiesError } = await supabase.rpc('exec_sql', { sql: companiesSQL });
    
    if (companiesError) {
      console.error('❌ 회사 데이터 삽입 실패:', companiesError);
    } else {
      console.log('✅ 회사 데이터 삽입 완료');
    }

    // 2. 사용자 데이터 삽입
    console.log('👥 사용자 데이터 삽입 중...');
    const usersSQL = `
      INSERT INTO "Users" (uid, email, "displayName", phone, level, type, agreement, "signupAt", "lastLogin", "updatedAt")
      VALUES 
        ('user001', 'blogger1@naver.com', '블로거김씨', '010-1111-2222', 'GOLD', 'BLOGGER', true, NOW(), NOW(), NOW()),
        ('user002', 'influencer@instagram.com', '인플루언서박', '010-2222-3333', 'DIAMOND', 'INFLUENCER', true, NOW(), NOW(), NOW()),
        ('user003', 'reviewer@youtube.com', '리뷰어이씨', '010-3333-4444', 'SILVER', 'REVIEWER', true, NOW(), NOW(), NOW())
      ON CONFLICT (uid) DO NOTHING;
    `;

    const { error: usersError } = await supabase.rpc('exec_sql', { sql: usersSQL });
    
    if (usersError) {
      console.error('❌ 사용자 데이터 삽입 실패:', usersError);
    } else {
      console.log('✅ 사용자 데이터 삽입 완료');
    }

    // 3. 키워드 데이터 삽입
    console.log('🔑 키워드 데이터 삽입 중...');
    const keywordsSQL = `
      INSERT INTO "Keywords" (name, cat1, cat2, "createdAt", "updatedAt", difficulty, efficiency)
      VALUES 
        ('뷰티살롱', '뷰티', '헤어', NOW(), NOW(), 7.5, 8.2),
        ('한식당', '음식', '한식', NOW(), NOW(), 6.8, 7.9),
        ('헬스장', '운동', '피트니스', NOW(), NOW(), 8.1, 7.5),
        ('카페', '음료', '커피', NOW(), NOW(), 9.2, 6.8),
        ('펫샵', '반려동물', '용품', NOW(), NOW(), 5.9, 8.7)
      ON CONFLICT (name) DO NOTHING;
    `;

    const { error: keywordsError } = await supabase.rpc('exec_sql', { sql: keywordsSQL });
    
    if (keywordsError) {
      console.error('❌ 키워드 데이터 삽입 실패:', keywordsError);
    } else {
      console.log('✅ 키워드 데이터 삽입 완료');
    }

    console.log('\n🎉 테스트 데이터 생성 완료!');
    console.log('\n🔗 다음 단계:');
    console.log('   - http://localhost:3001/api/supabase/test 에서 데이터 확인');

  } catch (error) {
    console.error('❌ 테스트 데이터 생성 중 오류 발생:', error);
    
    // RLS 정책 문제인 경우 안내
    if (error.code === '42501') {
      console.log('\n💡 해결 방법:');
      console.log('1. Supabase 대시보드 → Settings → API에서 service_role key 복사');
      console.log('2. .env.local에 SUPABASE_SERVICE_ROLE_KEY 추가');
      console.log('3. 또는 Supabase SQL Editor에서 다음 명령 실행:');
      console.log('   ALTER TABLE "Companies" DISABLE ROW LEVEL SECURITY;');
      console.log('   ALTER TABLE "Users" DISABLE ROW LEVEL SECURITY;');
      console.log('   ALTER TABLE "Keywords" DISABLE ROW LEVEL SECURITY;');
    }
  }
}

// 대안: 간단한 테스트 데이터 생성 함수
async function createSimpleTestData() {
  console.log('🌱 간단한 테스트 데이터 생성 시작...\n');

  try {
    // RLS를 우회하여 직접 삽입 시도
    console.log('📊 회사 데이터 삽입 시도...');
    
    // 하나씩 삽입해보기
    const testCompany = {
      email: 'test@example.com',
      name: '테스트 회사',
      charger: '테스트 담당자',
      contacts: '010-0000-0000',
      is_active: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('Companies')
      .insert([testCompany])
      .select();

    if (error) {
      console.error('❌ 테스트 데이터 삽입 실패:', error);
      console.log('\n💡 RLS 정책으로 인한 실패입니다.');
      console.log('Supabase 대시보드에서 Service Role Key를 가져와서');
      console.log('.env.local에 SUPABASE_SERVICE_ROLE_KEY를 추가해주세요.');
    } else {
      console.log('✅ 테스트 데이터 삽입 성공:', data);
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// 스크립트 실행
createSimpleTestData(); 