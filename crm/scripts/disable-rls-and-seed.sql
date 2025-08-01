-- 테스트 데이터 삽입을 위한 RLS 임시 비활성화 및 데이터 삽입 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. RLS 임시 비활성화 (테스트 목적)
ALTER TABLE "Companies" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Keywords" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Ads" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Contracts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "App_Inquiry" DISABLE ROW LEVEL SECURITY;

-- 2. 테스트 데이터 삽입

-- 회사 데이터
INSERT INTO "Companies" (email, name, charger, contacts, is_active, "createdAt", "updatedAt", memo)
VALUES 
  ('contact@beautysalon.co.kr', '뷰티살롱 미라클', '김미영', '010-1234-5678', 1, NOW(), NOW(), '강남 지역 프리미엄 뷰티살롱'),
  ('info@restaurant-delicious.com', '맛있는 한식당', '박요리', '010-2345-6789', 1, NOW(), NOW(), '전통 한식 전문점'),
  ('hello@fitnessgym.kr', '헬스클럽 스트롱', '이근육', '010-3456-7890', 1, NOW(), NOW(), '24시간 운영 헬스장'),
  ('contact@cafebean.co.kr', '카페 원두향', '최커피', '010-4567-8901', 1, NOW(), NOW(), '스페셜티 커피 전문점'),
  ('admin@petshop.com', '펫샵 멍냥이', '강애견', '010-5678-9012', 1, NOW(), NOW(), '반려동물 용품 전문점')
ON CONFLICT (email) DO NOTHING;

-- 사용자 데이터
INSERT INTO "Users" (uid, email, "displayName", phone, level, type, agreement, "signupAt", "lastLogin", "updatedAt")
VALUES 
  ('user001', 'blogger1@naver.com', '블로거김씨', '010-1111-2222', 'GOLD', 'BLOGGER', true, NOW(), NOW(), NOW()),
  ('user002', 'influencer@instagram.com', '인플루언서박', '010-2222-3333', 'DIAMOND', 'INFLUENCER', true, NOW(), NOW(), NOW()),
  ('user003', 'reviewer@youtube.com', '리뷰어이씨', '010-3333-4444', 'SILVER', 'REVIEWER', true, NOW(), NOW(), NOW())
ON CONFLICT (uid) DO NOTHING;

-- 키워드 데이터
INSERT INTO "Keywords" (name, cat1, cat2, "createdAt", "updatedAt", difficulty, efficiency)
VALUES 
  ('뷰티살롱', '뷰티', '헤어', NOW(), NOW(), 7.5, 8.2),
  ('한식당', '음식', '한식', NOW(), NOW(), 6.8, 7.9),
  ('헬스장', '운동', '피트니스', NOW(), NOW(), 8.1, 7.5),
  ('카페', '음료', '커피', NOW(), NOW(), 9.2, 6.8),
  ('펫샵', '반려동물', '용품', NOW(), NOW(), 5.9, 8.7)
ON CONFLICT (name) DO NOTHING;

-- 광고 데이터 (회사 ID 참조)
INSERT INTO "Ads" ("companyId", name, category, verified, "createdAt", "updatedAt", address, keywords, memo)
SELECT 
  c.id,
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN '뷰티살롱 미라클 - 헤어컷 체험단'
    WHEN c.name = '맛있는 한식당' THEN '맛있는 한식당 - 정통 한정식 리뷰'
    WHEN c.name = '헬스클럽 스트롱' THEN '헬스클럽 스트롱 - PT 체험 후기'
  END as name,
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN '뷰티/헤어'
    WHEN c.name = '맛있는 한식당' THEN '음식/한식'
    WHEN c.name = '헬스클럽 스트롱' THEN '운동/피트니스'
  END as category,
  CASE 
    WHEN c.name = '헬스클럽 스트롱' THEN false
    ELSE true
  END as verified,
  NOW() as "createdAt",
  NOW() as "updatedAt",
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN '서울시 강남구 테헤란로 123'
    WHEN c.name = '맛있는 한식당' THEN '서울시 종로구 인사동길 456'
    WHEN c.name = '헬스클럽 스트롱' THEN '서울시 마포구 홍대입구역 789'
  END as address,
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN '뷰티살롱, 헤어컷, 강남'
    WHEN c.name = '맛있는 한식당' THEN '한식당, 한정식, 인사동'
    WHEN c.name = '헬스클럽 스트롱' THEN '헬스장, PT, 홍대'
  END as keywords,
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN '프리미엄 헤어컷 체험단 모집'
    WHEN c.name = '맛있는 한식당' THEN '전통 한정식 맛집 리뷰어 모집'
    WHEN c.name = '헬스클럽 스트롱' THEN '개인 트레이닝 체험 후기 작성'
  END as memo
FROM "Companies" c
WHERE c.name IN ('뷰티살롱 미라클', '맛있는 한식당', '헬스클럽 스트롱');

-- 계약 데이터 (광고 ID와 사용자 참조)
INSERT INTO "Contracts" (id, company, "companyName", "currentState", "user", "userEmail", "createdAt", "updatedAt", "payPrice", type)
SELECT 
  'contract_' || LPAD(ROW_NUMBER() OVER()::text, 3, '0') as id,
  a.id as company,
  c.name as "companyName",
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN 2
    WHEN c.name = '맛있는 한식당' THEN 1
    WHEN c.name = '헬스클럽 스트롱' THEN 0
  END as "currentState",
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN 'user001'
    WHEN c.name = '맛있는 한식당' THEN 'user002'
    WHEN c.name = '헬스클럽 스트롱' THEN 'user003'
  END as "user",
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN 'blogger1@naver.com'
    WHEN c.name = '맛있는 한식당' THEN 'influencer@instagram.com'
    WHEN c.name = '헬스클럽 스트롱' THEN 'reviewer@youtube.com'
  END as "userEmail",
  NOW() as "createdAt",
  NOW() as "updatedAt",
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN 50000
    WHEN c.name = '맛있는 한식당' THEN 80000
    WHEN c.name = '헬스클럽 스트롱' THEN 120000
  END as "payPrice",
  CASE 
    WHEN c.name = '뷰티살롱 미라클' THEN 'BLOG_REVIEW'
    WHEN c.name = '맛있는 한식당' THEN 'INSTAGRAM_POST'
    WHEN c.name = '헬스클럽 스트롱' THEN 'YOUTUBE_REVIEW'
  END as type
FROM "Ads" a
JOIN "Companies" c ON a."companyId" = c.id
WHERE c.name IN ('뷰티살롱 미라클', '맛있는 한식당', '헬스클럽 스트롱');

-- 문의사항 데이터
INSERT INTO "App_Inquiry" (uid, category, "subCategory", "contentText", "isAnswered", "answeredAt", "createdAt")
VALUES 
  ('user001', '결제 문의', '결제 오류', '결제가 정상적으로 처리되지 않았습니다. 확인 부탁드립니다.', false, NULL, NOW()),
  ('user002', '광고 문의', '광고 승인', '광고 승인이 지연되고 있는 것 같습니다. 언제쯤 승인될까요?', true, NOW(), NOW());

-- 3. 데이터 확인
SELECT '=== 생성된 데이터 확인 ===' as status;

SELECT 'Companies' as table_name, COUNT(*) as count FROM "Companies"
UNION ALL
SELECT 'Users' as table_name, COUNT(*) as count FROM "Users"
UNION ALL
SELECT 'Keywords' as table_name, COUNT(*) as count FROM "Keywords"
UNION ALL
SELECT 'Ads' as table_name, COUNT(*) as count FROM "Ads"
UNION ALL
SELECT 'Contracts' as table_name, COUNT(*) as count FROM "Contracts"
UNION ALL
SELECT 'App_Inquiry' as table_name, COUNT(*) as count FROM "App_Inquiry";

-- 4. RLS 다시 활성화 (보안을 위해)
-- 주의: 실제 운영 환경에서는 적절한 RLS 정책을 설정한 후 활성화하세요
-- ALTER TABLE "Companies" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Keywords" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Ads" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Contracts" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "App_Inquiry" ENABLE ROW LEVEL SECURITY;

SELECT '테스트 데이터 생성 완료!' as message; 