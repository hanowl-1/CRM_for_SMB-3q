'use client';

import { KakaoTemplate } from '@/lib/types/template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MessageSquare, Image, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: KakaoTemplate;
  onPreview: (template: KakaoTemplate) => void;
  onSelect?: (template: KakaoTemplate) => void;
  isSelected?: boolean;
  showSelectButton?: boolean;
}

export function TemplateCard({ 
  template, 
  onPreview, 
  onSelect, 
  isSelected = false,
  showSelectButton = false 
}: TemplateCardProps) {
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

  return (
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
            <p className="text-xs text-muted-foreground mt-1">
              {template.templateCode}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {getStatusBadge(template.status, template.inspectionStatus)}
            {getChannelBadge(template.channelKey)}
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
  );
} 