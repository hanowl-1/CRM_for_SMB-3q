import { NextResponse } from 'next/server';
import mysqlDataService from '@/lib/services/mysql-data-service';

// GET /api/mysql/companies
export async function GET(request) {
  try {
    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * limit;

    // MySQL 연결 초기화
    const isConnected = await mysqlDataService.initialize();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'MySQL 데이터베이스 연결 실패' },
        { status: 500 }
      );
    }

    let companies;
    
    // 검색어가 있으면 검색, 없으면 전체 조회
    if (search) {
      companies = await mysqlDataService.searchCompanies(search, limit);
    } else {
      companies = await mysqlDataService.getCompanies(limit, offset);
    }

    return NextResponse.json({
      success: true,
      data: companies,
      pagination: {
        page,
        limit,
        total: companies.length
      }
    });

  } catch (error) {
    console.error('회사 데이터 조회 실패:', error);
    return NextResponse.json(
      { 
        error: '회사 데이터 조회 중 오류가 발생했습니다',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 