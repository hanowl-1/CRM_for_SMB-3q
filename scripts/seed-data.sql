-- 샘플 고객 데이터 삽입
INSERT INTO customers (name, phone, email, user_data) VALUES
('홍길동', '010-1234-5678', 'hong@example.com', '{"cartPrice": 50000, "lastLogin": "2024-01-15", "vipLevel": "gold"}'),
('김영희', '010-2345-6789', 'kim@example.com', '{"cartPrice": 30000, "lastLogin": "2024-01-14", "vipLevel": "silver"}'),
('박철수', '010-3456-7890', 'park@example.com', '{"cartPrice": 80000, "lastLogin": "2024-01-13", "vipLevel": "platinum"}'),
('이미영', '010-4567-8901', 'lee@example.com', '{"cartPrice": 25000, "lastLogin": "2024-01-12", "vipLevel": "bronze"}'),
('정민수', '010-5678-9012', 'jung@example.com', '{"cartPrice": 45000, "lastLogin": "2024-01-11", "vipLevel": "gold"}');

-- 샘플 캠페인 데이터 삽입
INSERT INTO campaigns (name, message_type, message_content, status, target_condition, trigger_event, delay_time, delay_unit) VALUES
('신규 회원 환영 메시지', 'alimtalk', '안녕하세요 {{고객명}}님! 회원가입을 환영합니다. 특별 할인 혜택을 확인해보세요!', 'active', '{"condition": "new_signup"}', 'signup', 0, 'minutes'),
('장바구니 미완료 알림', 'sms', '{{고객명}}님, 장바구니에 {{상품명}}이 기다리고 있어요! 지금 구매하시면 {{할인율}} 할인!', 'active', '{"condition": "cart_abandoned"}', 'cart_add', 60, 'minutes'),
('구매 완료 감사 메시지', 'alimtalk', '{{고객명}}님, 구매해주셔서 감사합니다! 다음 구매 시 사용할 수 있는 쿠폰을 드려요.', 'active', '{"condition": "purchase_complete"}', 'purchase', 5, 'minutes');

-- 캠페인 변수 데이터 삽입
INSERT INTO campaign_variables (campaign_id, variable_name) VALUES
(1, '고객명'),
(2, '고객명'),
(2, '상품명'),
(2, '할인율'),
(3, '고객명');

-- 샘플 메시지 로그 데이터 삽입
INSERT INTO message_logs (campaign_id, customer_id, phone, message_content, message_type, status, sent_at, delivered_at, opened_at) VALUES
(1, 1, '010-1234-5678', '안녕하세요 홍길동님! 회원가입을 환영합니다. 특별 할인 혜택을 확인해보세요!', 'alimtalk', 'opened', '2024-01-15 10:00:00', '2024-01-15 10:00:30', '2024-01-15 10:05:00'),
(1, 2, '010-2345-6789', '안녕하세요 김영희님! 회원가입을 환영합니다. 특별 할인 혜택을 확인해보세요!', 'alimtalk', 'delivered', '2024-01-15 10:01:00', '2024-01-15 10:01:30', NULL),
(2, 3, '010-3456-7890', '박철수님, 장바구니에 프리미엄 상품이 기다리고 있어요! 지금 구매하시면 20% 할인!', 'sms', 'clicked', '2024-01-15 11:00:00', '2024-01-15 11:00:30', '2024-01-15 11:05:00');

-- 캠페인 통계 데이터 삽입
INSERT INTO campaign_stats (campaign_id, date, sent_count, delivered_count, opened_count, clicked_count) VALUES
(1, '2024-01-15', 250, 245, 180, 32),
(1, '2024-01-14', 320, 315, 250, 45),
(2, '2024-01-15', 150, 148, 120, 25),
(3, '2024-01-15', 180, 175, 140, 28);
