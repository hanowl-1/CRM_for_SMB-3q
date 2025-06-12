import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key가 환경변수에 설정되지 않았습니다.');
}

// 클라이언트용 Supabase 인스턴스 (RLS 적용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버용 Supabase 인스턴스 (RLS 우회 가능)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

// 연결 테스트 함수
export async function testSupabaseConnection() {
  try {
    // 간단한 연결 테스트 - 테이블이 없어도 작동
    const { data, error } = await supabase
      .from('Companies')
      .select('*')
      .limit(1);
    
    if (error) {
      // 테이블이 없는 경우의 에러는 정상적인 연결로 간주
      if (error.code === '42P01') {
        console.log('Supabase 연결 성공 (테이블 미생성 상태)');
        return true;
      }
      console.error('Supabase 연결 테스트 실패:', error);
      return false;
    }
    
    console.log('Supabase 연결 테스트 성공');
    return true;
  } catch (error) {
    console.error('Supabase 연결 오류:', error);
    return false;
  }
}

// 데이터베이스 정보 조회
export async function getSupabaseInfo() {
  try {
    // PostgreSQL 시스템 테이블을 직접 쿼리
    const { data: tables, error: tablesError } = await supabaseAdmin
      .rpc('get_table_list');

    // RPC 함수가 없는 경우 대체 방법 사용
    if (tablesError) {
      // 알려진 테이블들을 직접 확인
      const knownTables = ['Companies', 'Users', 'Ads', 'Contracts', 'Keywords'];
      const existingTables = [];
      
      for (const tableName of knownTables) {
        try {
          const { error } = await supabaseAdmin
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!error || error.code !== '42P01') {
            existingTables.push(tableName);
          }
        } catch (e) {
          // 테이블이 없는 경우 무시
        }
      }
      
      return {
        tables: existingTables,
        version: 'PostgreSQL (Supabase)',
        url: supabaseUrl,
        connected: true,
        note: '일부 테이블만 확인됨 (마이그레이션 필요할 수 있음)'
      };
    }

    return {
      tables: tables || [],
      version: 'PostgreSQL (Supabase)',
      url: supabaseUrl,
      connected: true
    };
  } catch (error) {
    console.error('Supabase 정보 조회 실패:', error);
    return {
      tables: [],
      version: 'Unknown',
      url: supabaseUrl,
      connected: true,
      error: error.message
    };
  }
} 