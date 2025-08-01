/**
 * 🔧 API 응답 표준화 유틸리티
 * 
 * 모든 API 라우트에서 일관된 응답 형식과 에러 처리를 제공합니다.
 */

import { NextResponse } from 'next/server';

// 📋 표준 API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

// ✅ 성공 응답 생성
export function createSuccessResponse<T>(
  data?: T, 
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  }, { status });
}

// ❌ 에러 응답 생성
export function createErrorResponse(
  error: string | Error,
  message?: string,
  status: number = 500
): NextResponse<ApiResponse> {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return NextResponse.json({
    success: false,
    message: message || '요청 처리 중 오류가 발생했습니다.',
    error: errorMessage,
    timestamp: new Date().toISOString()
  }, { status });
}

// 🔍 입력 검증 에러
export function createValidationError(
  message: string,
  field?: string
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    message: `입력 검증 실패: ${message}`,
    error: field ? `${field} 필드가 유효하지 않습니다.` : message,
    timestamp: new Date().toISOString()
  }, { status: 400 });
}

// 🚫 권한 에러
export function createUnauthorizedError(
  message: string = '권한이 없습니다.'
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    message,
    error: 'Unauthorized',
    timestamp: new Date().toISOString()
  }, { status: 401 });
}

// 🔍 리소스 없음 에러
export function createNotFoundError(
  resource: string = '리소스'
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    message: `${resource}를 찾을 수 없습니다.`,
    error: 'Not Found',
    timestamp: new Date().toISOString()
  }, { status: 404 });
}

// 🛡️ 안전한 에러 처리 래퍼
export async function handleApiRequest<T>(
  handler: () => Promise<T>,
  errorMessage?: string
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const result = await handler();
    return createSuccessResponse(result);
  } catch (error) {
    console.error('API 요청 처리 중 오류:', error);
    
    // 알려진 에러 타입들에 대한 특별 처리
    if (error instanceof Error) {
      if (error.message.includes('validation') || error.message.includes('검증')) {
        return createValidationError(error.message);
      }
      if (error.message.includes('unauthorized') || error.message.includes('권한')) {
        return createUnauthorizedError(error.message);
      }
      if (error.message.includes('not found') || error.message.includes('찾을 수 없습니다')) {
        return createNotFoundError();
      }
    }
    
    return createErrorResponse(error, errorMessage);
  }
}

// 📝 로깅과 함께 에러 처리
export function logAndCreateErrorResponse(
  error: unknown,
  context: string,
  message?: string,
  status: number = 500
): NextResponse<ApiResponse> {
  console.error(`❌ ${context} 오류:`, error);
  
  if (error instanceof Error) {
    console.error(`❌ ${context} 스택:`, error.stack);
  }
  
  return createErrorResponse(error as Error, message, status);
} 