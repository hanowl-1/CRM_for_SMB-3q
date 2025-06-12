import { createClient } from '@supabase/supabase-js';

// 환경변수 확인 및 기본값 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 빌드 시 환경변수가 없어도 에러가 나지 않도록 처리
let supabase = null;
let supabaseAdmin = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    // 일반 클라이언트 (anon key 사용)
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // 관리자 클라이언트 (service role key 사용)
    if (supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      // service key가 없으면 anon key로 대체
      supabaseAdmin = supabase;
    }
  } catch (error) {
    console.error('Supabase 클라이언트 초기화 실패:', error);
  }
}

// Supabase 연결 테스트 함수
export async function testSupabaseConnection() {
  if (!supabase) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다. 환경변수를 확인해주세요.');
  }
  
  try {
    // 간단한 연결 테스트
    const { data, error } = await supabase
      .from('_supabase_migrations')
      .select('version')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // 테이블이 없는 경우는 정상
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Supabase 연결 테스트 실패:', error);
    return false;
  }
}

// Supabase 정보 조회 함수
export function getSupabaseInfo() {
  return {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
    isInitialized: !!(supabase && supabaseAdmin)
  };
}

export { supabase, supabaseAdmin }; 