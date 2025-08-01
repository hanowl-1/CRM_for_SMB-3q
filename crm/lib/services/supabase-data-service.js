import { supabase, supabaseAdmin, testSupabaseConnection, getSupabaseInfo } from '../database/supabase-client';

class SupabaseDataService {
  constructor() {
    this.isConnected = false;
  }

  // 연결 초기화
  async initialize() {
    try {
      this.isConnected = await testSupabaseConnection();
      if (this.isConnected) {
        const dbInfo = await getSupabaseInfo();
        console.log('Supabase 데이터베이스 정보:', dbInfo);
      }
      return this.isConnected;
    } catch (error) {
      console.error('Supabase 초기화 실패:', error);
      return false;
    }
  }

  // 회사 정보 조회
  async getCompanies(limit = 100, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('Companies')
        .select(`
          id, email, name, charger, contacts, 
          createdAt, updatedAt, last_login
        `)
        .eq('is_active', 1)
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('회사 정보 조회 실패:', error);
      throw error;
    }
  }

  // 특정 회사 정보 조회
  async getCompanyById(companyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('Companies')
        .select('*')
        .eq('id', companyId)
        .eq('is_active', 1)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('회사 정보 조회 실패:', error);
      throw error;
    }
  }

  // 광고 목록 조회
  async getAds(companyId = null, limit = 100, offset = 0) {
    try {
      let query = supabaseAdmin
        .from('Ads')
        .select(`
          id, name, companyId, category, verified,
          createdAt, updatedAt,
          Companies!inner(name)
        `)
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (companyId) {
        query = query.eq('companyId', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('광고 목록 조회 실패:', error);
      throw error;
    }
  }

  // 계약 정보 조회
  async getContracts(companyId = null, limit = 100, offset = 0) {
    try {
      let query = supabaseAdmin
        .from('Contracts')
        .select(`
          id, company, companyName, currentState,
          user, userEmail, createdAt, updatedAt,
          Ads!inner(name)
        `)
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (companyId) {
        query = query.eq('Ads.companyId', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('계약 정보 조회 실패:', error);
      throw error;
    }
  }

  // 사용자 정보 조회
  async getUsers(limit = 100, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('Users')
        .select(`
          uid, email, displayName, phone, level, type,
          signupAt, lastLogin, updatedAt
        `)
        .eq('agreement', true)
        .order('signupAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      throw error;
    }
  }

  // 문의사항 조회
  async getInquiries(limit = 100, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('App_Inquiry')
        .select(`
          id, uid, category, subCategory,
          contentText, isAnswered, createdAt,
          App_Inquiry_Answer(count)
        `)
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('문의사항 조회 실패:', error);
      throw error;
    }
  }

  // 결제 정보 조회
  async getPayments(companyId = null, limit = 100, offset = 0) {
    try {
      let query = supabaseAdmin
        .from('Ads_Payment')
        .select(`
          id, adId, amount, payState,
          payMethod, paidAt, createdAt,
          Ads!inner(name, Companies!inner(name))
        `)
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (companyId) {
        query = query.eq('Ads.companyId', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('결제 정보 조회 실패:', error);
      throw error;
    }
  }

  // 통계 데이터 조회
  async getStatistics() {
    try {
      // count 쿼리를 개별적으로 실행하여 구문 오류 방지
      const companiesResult = await supabaseAdmin
        .from('Companies')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', 1);

      const adsResult = await supabaseAdmin
        .from('Ads')
        .select('*', { count: 'exact', head: true });

      const contractsResult = await supabaseAdmin
        .from('Contracts')
        .select('*', { count: 'exact', head: true });

      const usersResult = await supabaseAdmin
        .from('Users')
        .select('*', { count: 'exact', head: true })
        .eq('agreement', true);

      const inquiriesResult = await supabaseAdmin
        .from('App_Inquiry')
        .select('*', { count: 'exact', head: true });

      // 최근 30일 가입 통계
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: dailySignups, error: signupError } = await supabaseAdmin
        .from('Companies')
        .select('createdAt')
        .gte('createdAt', thirtyDaysAgo.toISOString())
        .order('createdAt', { ascending: false });

      // 날짜별 그룹화
      const signupsByDate = {};
      if (dailySignups) {
        dailySignups.forEach(company => {
          const date = new Date(company.createdAt).toISOString().split('T')[0];
          signupsByDate[date] = (signupsByDate[date] || 0) + 1;
        });
      }

      return {
        totalCompanies: companiesResult.count || 0,
        totalAds: adsResult.count || 0,
        totalContracts: contractsResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalInquiries: inquiriesResult.count || 0,
        dailySignups: Object.entries(signupsByDate).map(([date, count]) => ({
          date,
          count
        })),
        errors: {
          companies: companiesResult.error?.message,
          ads: adsResult.error?.message,
          contracts: contractsResult.error?.message,
          users: usersResult.error?.message,
          inquiries: inquiriesResult.error?.message
        }
      };
    } catch (error) {
      console.error('통계 데이터 조회 실패:', error);
      
      // 테이블이 없는 경우 기본값 반환
      if (error.code === '42P01') {
        return {
          totalCompanies: 0,
          totalAds: 0,
          totalContracts: 0,
          totalUsers: 0,
          totalInquiries: 0,
          dailySignups: [],
          note: '데이터베이스 테이블이 생성되지 않았습니다. 마이그레이션을 실행해주세요.'
        };
      }
      
      throw error;
    }
  }

  // 검색 기능
  async searchCompanies(searchTerm, limit = 50) {
    try {
      const { data, error } = await supabaseAdmin
        .from('Companies')
        .select('id, email, name, charger, contacts, createdAt')
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,charger.ilike.%${searchTerm}%`)
        .eq('is_active', 1)
        .order('createdAt', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('회사 검색 실패:', error);
      throw error;
    }
  }

  // 데이터 내보내기
  async exportData(tableName, conditions = {}, limit = 1000) {
    try {
      let query = supabaseAdmin
        .from(tableName)
        .select('*')
        .limit(limit);

      // 조건 추가
      Object.entries(conditions).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
      throw error;
    }
  }
}

export default new SupabaseDataService(); 