import { NextRequest, NextResponse } from 'next/server';
import { MappingTemplateService } from '@/lib/services/mapping-template-service';

// 매핑 템플릿 목록 조회
export async function GET() {
  try {
    console.log('📊 매핑 템플릿 조회 API 호출됨');
    
    const templates = await MappingTemplateService.getAllTemplates();
    
    return NextResponse.json({
      success: true,
      data: templates,
      message: `${templates.length}개의 매핑 템플릿을 조회했습니다.`
    });
  } catch (error) {
    console.error('❌ 매핑 템플릿 조회 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '매핑 템플릿 조회에 실패했습니다.',
      data: []
    }, { status: 500 });
  }
}

// 매핑 템플릿 저장
export async function POST(request: NextRequest) {
  try {
    console.log('💾 매핑 템플릿 저장 API 호출됨');
    
    const templateData = await request.json();
    
    const savedTemplate = await MappingTemplateService.saveTemplate(templateData);
    
    return NextResponse.json({
      success: true,
      data: savedTemplate,
      message: '매핑 템플릿이 성공적으로 저장되었습니다.'
    });
  } catch (error) {
    console.error('❌ 매핑 템플릿 저장 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '매핑 템플릿 저장에 실패했습니다.'
    }, { status: 500 });
  }
} 