import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yamljs';

export async function GET(request: NextRequest) {
  try {
    const filePath = join(process.cwd(), 'public', 'api-spec.yaml');
    const yamlContent = readFileSync(filePath, 'utf8');
    
    // YAML을 JSON으로 변환
    const spec = yaml.parse(yamlContent);
    
    // 요청에서 baseUrl 가져오기
    const { protocol, host } = new URL(request.url);
    const baseUrl = `${protocol}//${host}`;
    
    // 서버 URL 동적 설정
    spec.servers = [
      {
        url: baseUrl,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ];

    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('API 스펙 로드 실패:', error);
    return NextResponse.json(
      { error: 'API 스펙을 로드할 수 없습니다.' },
      { status: 500 }
    );
  }
} 