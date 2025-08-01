import { NextResponse } from 'next/server';
import mysqlDataService from '@/lib/services/mysql-data-service';

// GET /api/mysql/statistics
export async function GET() {
  try {
    // MySQL 연결 초기화
    const isConnected = await mysqlDataService.initialize();
    if (!isConnected) {
      return NextResponse.json(
        { error: 'MySQL 데이터베이스 연결 실패' },
        { status: 500 }
      );
    }

    // 통계 데이터 조회
    const statistics = await mysqlDataService.getStatistics();

    return NextResponse.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('통계 데이터 조회 실패:', error);
    return NextResponse.json(
      { 
        error: '통계 데이터 조회 중 오류가 발생했습니다',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 