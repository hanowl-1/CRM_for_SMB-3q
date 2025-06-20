import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 환경변수 확인 및 기본값 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🔧 Supabase 클라이언트 초기화 중...');
console.log('URL:', supabaseUrl);
console.log('Anon Key 존재:', !!supabaseAnonKey);
console.log('Service Key 존재:', !!supabaseServiceKey);
console.log('Service Key 길이:', supabaseServiceKey.length);

// Supabase 클라이언트를 안전하게 초기화하는 함수
function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase URL 또는 Anon Key가 없습니다');
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('❌ Supabase 일반 클라이언트 초기화 실패:', error);
    return null;
  }
}

// Supabase 관리자 클라이언트를 안전하게 초기화하는 함수
function createSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseUrl) {
    console.error('❌ Supabase URL이 없습니다');
    return null;
  }

  // Service Role Key가 있으면 사용, 없으면 anon key 사용
  const keyToUse = supabaseServiceKey || supabaseAnonKey;
  
  if (!keyToUse) {
    console.error('❌ Service Role Key와 Anon Key가 모두 없습니다');
    return null;
  }

  try {
    const client = createClient(supabaseUrl, keyToUse, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    if (supabaseServiceKey) {
      console.log('✅ Supabase 관리자 클라이언트 초기화 성공 (Service Role Key 사용)');
    } else {
      console.warn('⚠️ Service Role Key가 없어서 anon key를 사용합니다');
      console.log('✅ Supabase 관리자 클라이언트 초기화 성공 (anon key 사용)');
    }
    
    return client;
  } catch (error) {
    console.error('❌ Supabase 관리자 클라이언트 초기화 실패:', error);
    return null;
  }
}

// 클라이언트 인스턴스들을 lazy하게 초기화
let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

// Getter 함수들로 lazy 초기화
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createSupabaseClient();
    if (supabase) {
      console.log('✅ Supabase 일반 클라이언트 초기화 성공');
    }
  }
  
  if (!supabase) {
    throw new Error('Supabase 클라이언트를 초기화할 수 없습니다. 환경변수를 확인해주세요.');
  }
  
  return supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createSupabaseAdminClient();
  }
  
  if (!supabaseAdmin) {
    // 관리자 클라이언트가 없으면 일반 클라이언트라도 반환
    console.warn('⚠️ 관리자 클라이언트 대신 일반 클라이언트를 사용합니다');
    return getSupabase();
  }
  
  return supabaseAdmin;
}

// Supabase 연결 테스트 함수
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabase();
    
    // 간단한 연결 테스트
    const { data, error } = await client
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

// 하위 호환성을 위한 export (deprecated)
export { supabase, supabaseAdmin }; 