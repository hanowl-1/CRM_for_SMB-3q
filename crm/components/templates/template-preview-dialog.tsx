'use client';

import { KakaoTemplate } from '@/lib/types/template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Copy, ExternalLink, Image, MessageSquare, Calendar, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TemplatePreviewDialogProps {
  template: KakaoTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (template: KakaoTemplate) => void;
  showSelectButton?: boolean;
}

export function TemplatePreviewDialog({ 
  template, 
  open, 
  onOpenChange, 
  onSelect,
  showSelectButton = false 
}: TemplatePreviewDialogProps) {
  const [copied, setCopied] = useState(false);

  console.log('TemplatePreviewDialog 렌더링:', { template: template?.templateName, open });

  if (!template) return null;

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(template.templateContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getStatusInfo = (status: string, inspectionStatus: string) => {
    if (status === 'A' && inspectionStatus === 'APR') {
      return { text: '승인됨', variant: 'default' as const, className: 'bg-green-100 text-green-800' };
    } else if (status === 'R' || inspectionStatus === 'REJ') {
      return { text: '거부됨', variant: 'destructive' as const, className: '' };
    } else if (inspectionStatus === 'REQ') {
      return { text: '검토중', variant: 'secondary' as const, className: '' };
    }
    return { text: '대기중', variant: 'outline' as const, className: '' };
  };

  const statusInfo = getStatusInfo(template.status, template.inspectionStatus);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderTemplateContent = (content: string) => {
    // 변수를 하이라이트하여 표시
    return content.split(/(#{[^}]+})/g).map((part, index) => {
      if (part.match(/#{[^}]+}/)) {
        return (
          <span key={index} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-sm font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] z-[9999]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold">
                {template.templateName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {template.templateCode}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Badge variant={statusInfo.variant} className={statusInfo.className}>
                {statusInfo.text}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {template.channelKey}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            {/* 템플릿 미리보기 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                메시지 미리보기
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-4 border">
                {template.templateImageUrl && (
                  <div className="mb-3">
                    <div className="w-full h-32 bg-gray-200 rounded-md flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">
                        {template.templateImageName || '이미지'}
                      </span>
                    </div>
                  </div>
                )}
                
                {template.templateTitle && (
                  <div className="mb-2">
                    <h4 className="font-medium text-gray-900">
                      {template.templateTitle}
                    </h4>
                  </div>
                )}
                
                {template.templateSubtitle && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-600">
                      {template.templateSubtitle}
                    </p>
                  </div>
                )}
                
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {renderTemplateContent(template.templateContent)}
                </div>
                
                {template.templateExtra && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      {template.templateExtra}
                    </p>
                  </div>
                )}
                
                {template.buttons && template.buttons.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {template.buttons.map((button, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-sm font-medium">{button.name}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* 템플릿 정보 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">템플릿 정보</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">템플릿 코드:</span>
                  <p className="font-mono">{template.templateCode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">발신키:</span>
                  <p className="font-mono">{template.senderKey}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">카테고리:</span>
                  <p>{template.categoryCode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">채널:</span>
                  <p>{template.channelKey}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">생성일:</span>
                    <p>{formatDate(template.createDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">수정일:</span>
                    <p>{formatDate(template.updateDate)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 변수 정보 */}
            {template.variables && template.variables.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    사용 변수 ({template.variables.length}개)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {template.variables.map((variable, index) => (
                      <Badge key={index} variant="outline" className="font-mono">
                        #{variable}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 버튼 정보 */}
            {template.buttons && template.buttons.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    버튼 정보 ({template.buttons.length}개)
                  </h3>
                  <div className="space-y-2">
                    {template.buttons.map((button, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{button.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {button.type}
                          </Badge>
                        </div>
                        {button.url_mobile && (
                          <p className="text-xs text-muted-foreground font-mono">
                            모바일: {button.url_mobile}
                          </p>
                        )}
                        {button.url_pc && (
                          <p className="text-xs text-muted-foreground font-mono">
                            PC: {button.url_pc}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleCopyContent}
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? '복사됨!' : '내용 복사'}
            </Button>
            
            {showSelectButton && onSelect && (
              <Button
                onClick={() => {
                  onSelect(template);
                  onOpenChange(false);
                }}
                className="flex-1"
              >
                이 템플릿 선택
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 