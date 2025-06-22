'use client';

import { useState, useMemo } from 'react';
import { KakaoTemplate } from '@/lib/types/template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MessageSquare, Image, ExternalLink, Link, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TemplateLinkInfoModal } from './template-link-info-modal';

interface TemplateCardProps {
  template: KakaoTemplate;
  onPreview: (template: KakaoTemplate) => void;
  onSelect?: (template: KakaoTemplate) => void;
  isSelected?: boolean;
  showSelectButton?: boolean;
  usageStatusBadge?: React.ReactNode;
}

export function TemplateCard({ 
  template, 
  onPreview, 
  onSelect, 
  isSelected = false,
  showSelectButton = false,
  usageStatusBadge
}: TemplateCardProps) {
  const [showLinkInfo, setShowLinkInfo] = useState(false);

  const getStatusBadge = (status: string, inspectionStatus: string) => {
    if (status === 'A' && inspectionStatus === 'APR') {
      return <Badge variant="default" className="bg-green-100 text-green-800">승인됨</Badge>;
    } else if (status === 'R' || inspectionStatus === 'REJ') {
      return <Badge variant="destructive">거부됨</Badge>;
    } else if (inspectionStatus === 'REQ') {
      return <Badge variant="secondary">검토중</Badge>;
    }
    return <Badge variant="outline">대기중</Badge>;
  };

  const getChannelBadge = (channelKey: string) => {
    const channelColors: Record<string, string> = {
      'MEMBERS': 'bg-blue-100 text-blue-800',
      'CHART': 'bg-purple-100 text-purple-800',
      'CEO': 'bg-orange-100 text-orange-800',
      'BLOGGER': 'bg-pink-100 text-pink-800'
    };
    
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs", channelColors[channelKey] || "bg-gray-100 text-gray-800")}
      >
        {channelKey}
      </Badge>
    );
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  // 링크 포함 여부 확인 (개선된 감지 로직)
  const hasLinks = useMemo(() => {
    // 버튼이 있는 경우
    if (template.buttons && template.buttons.length > 0) {
      return true;
    }
    
    // 텍스트에서 링크 관련 키워드 감지 (확장된 키워드)
    const content = template.templateContent || '';
    const linkKeywords = [
      // 직접적인 링크 키워드
      '링크로', '링크에서', '링크를', '링크', '아래 링크', '다음 링크', '해당 링크',
      
      // URL 패턴
      'http://', 'https://', 'www.',
      
      // 액션 키워드
      '클릭', '접속', '바로가기', '이동',
      '자세히 보기', '더 보기', '더보기',
      '확인하기', '확인하세요', '확인해', '확인',
      '신청하기', '참여하기', '등록하기',
      '조회하기', '조회하세요', '조회',
      '보기', '보러가기', '보세요',
      '방문하기', '방문', '접속하기',
      
      // 버튼 관련 키워드
      '버튼', '눌러', '터치', '선택',
      
      // 앱/웹 관련 키워드
      '앱에서', '홈페이지', '사이트',
      
      // 기타 링크 암시 키워드
      '제출해', '업로드', '다운로드',
      '문의', '상담', '신고'
    ];
    
    // 대소문자 구분 없이 검색
    const lowerContent = content.toLowerCase();
    return linkKeywords.some(keyword => 
      lowerContent.includes(keyword.toLowerCase())
    );
  }, [template.buttons, template.templateContent]);

  return (
    <>
      <Card className={cn(
        "h-full transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-blue-500 bg-blue-50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-medium truncate">
                {template.templateName}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  {template.templateCode}
                </p>
                {template.templateNumber && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                    #{template.templateNumber}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {getStatusBadge(template.status, template.inspectionStatus)}
              {getChannelBadge(template.channelKey)}
              {template.servicePlatform && (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
                  {template.servicePlatform}
                </Badge>
              )}
              {usageStatusBadge && (
                <div className="mt-1">
                  {usageStatusBadge}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {template.templateTitle && (
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-900">
                {template.templateTitle}
              </p>
            </div>
          )}
          
          <div className="mb-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              {truncateContent(template.templateContent)}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>{template.variables?.length || 0} 변수</span>
            </div>
            
            {template.buttons && template.buttons.length > 0 && (
              <div className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <span>{template.buttons.length} 버튼</span>
              </div>
            )}
            
            {hasLinks && (
              <div className="flex items-center gap-1 text-blue-600">
                <Link className="w-3 h-3" />
                <span>링크 포함</span>
              </div>
            )}
            
            {template.templateImageUrl && (
              <div className="flex items-center gap-1">
                <Image className="w-3 h-3" />
                <span>이미지</span>
              </div>
            )}
          </div>

          {template.variables && template.variables.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1">
                {template.variables.slice(0, 3).map((variable, index) => (
                  <Badge key={index} variant="outline" className="text-xs px-1.5 py-0.5">
                    #{variable}
                  </Badge>
                ))}
                {template.variables.length > 3 && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                    +{template.variables.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPreview(template)}
              className="flex-1"
            >
              <Eye className="w-3 h-3 mr-1" />
              미리보기
            </Button>

            {hasLinks && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLinkInfo(true)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                title="링크 정보 확인"
              >
                <Info className="w-3 h-3" />
                링크
              </Button>
            )}
            
            {showSelectButton && onSelect && (
              <Button
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => onSelect(template)}
                className="flex-1"
              >
                {isSelected ? "선택됨" : "선택"}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* 링크 정보 모달 */}
      <TemplateLinkInfoModal
        template={template}
        isOpen={showLinkInfo}
        onClose={() => setShowLinkInfo(false)}
      />
    </>
  );
} 