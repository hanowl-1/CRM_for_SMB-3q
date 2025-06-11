import { NextResponse } from "next/server"

// 실제로는 데이터베이스에서 테이블 스키마를 조회하여 반환
export async function GET() {
  // 예시 DB 필드 정보
  const fields = [
    { name: "user_name", label: "고객명", type: "string", table: "users" },
    { name: "user_email", label: "이메일", type: "string", table: "users" },
    { name: "user_phone", label: "전화번호", type: "string", table: "users" },
    { name: "user_age", label: "나이", type: "number", table: "users" },
    { name: "membership_level", label: "회원등급", type: "string", table: "users" },
    { name: "signup_date", label: "가입일", type: "date", table: "users" },
    { name: "last_login", label: "최근 로그인", type: "datetime", table: "users" },
    { name: "total_spent", label: "총 구매금액", type: "number", table: "orders" },
    { name: "purchase_count", label: "구매횟수", type: "number", table: "orders" },
    { name: "last_purchase_date", label: "최근 구매일", type: "date", table: "orders" },
    { name: "cart_total", label: "장바구니 금액", type: "number", table: "carts" },
    { name: "cart_item_count", label: "장바구니 상품수", type: "number", table: "carts" },
    { name: "favorite_category", label: "선호 카테고리", type: "string", table: "user_preferences" },
  ]

  return NextResponse.json(fields)
}
