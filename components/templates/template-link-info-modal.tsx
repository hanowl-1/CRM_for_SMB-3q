'use client';

import { useState, useEffect } from 'react';
import { KakaoTemplate } from '@/lib/types/template';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  Phone, 
  MessageCircle, 
  Bot, 
  Smartphone,
  AlertCircle,
  RefreshCw,
  Copy,
  CheckCircle,
  Link,
  Info,
  Monitor,
  Globe,
  Calendar,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateLinkInfoModalProps {
  template: KakaoTemplate;
  isOpen: boolean;
  onClose: () => void;
}

interface TemplateDetails {
  templateId: string;
  name: string;
  content: string;
  status: string;
  categoryCode: string;
  buttons: Array<{
    buttonName: string;
    buttonType: string;
    linkMo?: string;
    linkPc?: string;
    linkAnd?: string;
    linkIos?: string;
    chatExtra?: string;
    targetOut?: string;
  }>;
  quickReplies: Array<{
    name: string;
    linkType: string;
    linkMo?: string;
    linkPc?: string;
    linkAnd?: string;
    linkIos?: string;
    chatExtra?: string;
    targetOut?: string;
  }>;
  variables: Array<{
    name: string;
  }>;
  emphasizeType?: string;
  messageType?: string;
  comments: Array<{
    memberId: string;
    content: string;
    isAdmin: boolean;
    dateCreated: string;
  }>;
  dateCreated: string;
  dateUpdated: string;
  linkInfo: {
    hasLinks: boolean;
    buttonCount: number;
    quickReplyCount: number;
    totalLinkCount: number;
    linkTypes: Array<{
      name: string;
      type: string;
      linkMo?: string;
      linkPc?: string;
      linkAnd?: string;
      linkIos?: string;
    }>;
  };
}

export function TemplateLinkInfoModal({ template, isOpen, onClose }: TemplateLinkInfoModalProps) {
  const [templateDetails, setTemplateDetails] = useState<TemplateDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // 템플릿 상세 정보 로드
  const loadTemplateDetails = async () => {
    if (!template.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 템플릿 상세 정보 조회:', template.id);
      // 실제 템플릿 ID 사용 (32자리 ID)
      const response = await fetch(`/api/templates/${template.id}/details`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTemplateDetails(result.data);
          console.log('✅ 템플릿 상세 정보 로드 완료:', result.data);
        } else {
          setError(result.error || '템플릿 정보를 가져올 수 없습니다.');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || `API 오류: ${response.status}`);
      }
    } catch (err) {
      console.error('❌ 템플릿 상세 정보 로드 실패:', err);
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 모달이 열릴 때 상세 정보 로드
  useEffect(() => {
    if (isOpen && template) {
      loadTemplateDetails();
    }
  }, [isOpen, template]);

  // URL 복사 기능
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  // 버튼 타입별 아이콘 및 정보
  const getButtonTypeInfo = (type: string) => {
    switch (type.toUpperCase()) {
      case 'WL':
        return {
          icon: <Globe className="w-4 h-4" />,
          name: '웹링크',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          description: '웹페이지로 이동'
        };
      case 'AL':
        return {
          icon: <Smartphone className="w-4 h-4" />,
          name: '앱링크',
          color: 'text-purple-600',
          bgColor: 'bg-purple-100',
          description: '앱으로 이동'
        };
      case 'DS':
        return {
          icon: <Phone className="w-4 h-4" />,
          name: '전화걸기',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          description: '전화번호로 연결'
        };
      case 'BK':
        return {
          icon: <MessageCircle className="w-4 h-4" />,
          name: '봇키워드',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          description: '챗봇 키워드 전송'
        };
      case 'MD':
        return {
          icon: <Calendar className="w-4 h-4" />,
          name: '메시지전달',
          color: 'text-pink-600',
          bgColor: 'bg-pink-100',
          description: '메시지 전달'
        };
      case 'BC':
        return {
          icon: <Bot className="w-4 h-4" />,
          name: '상담톡전환',
          color: 'text-indigo-600',
          bgColor: 'bg-indigo-100',
          description: '상담톡으로 전환'
        };
      case 'BT':
        return {
          icon: <MessageCircle className="w-4 h-4" />,
          name: '봇전환',
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          description: '챗봇으로 전환'
        };
      default:
        return {
          icon: <ExternalLink className="w-4 h-4" />,
          name: type,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          description: '기타 링크'
        };
    }
  };

  // 링크 정보 요약
  const linkSummary = {
    hasLinks: (template.buttons && template.buttons.length > 0) || 
              template.templateContent.includes('링크') ||
              template.templateContent.includes('클릭') ||
              template.templateContent.includes('바로가기'),
    totalButtons: template.buttons?.length || 0,
    buttonTypes: template.buttons ? 
      [...new Set(template.buttons.map(btn => btn.type))].length : 0
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            템플릿 링크 정보
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 템플릿 기본 정보 */}
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">템플릿 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">템플릿명:</p>
                  <p className="font-medium">{template.templateName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">템플릿 코드:</p>
                  <p className="font-medium">{template.templateCode}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 로딩 및 에러 상태 */}
          {isLoading && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>CoolSMS API에서 상세 정보를 가져오는 중...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-red-800">
                <div className="font-medium mb-1">조회 실패</div>
                <div className="text-sm">
                  CoolSMS API 오류: {error}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTemplateDetails}
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  다시 시도
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 링크 정보 요약 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Link className="w-5 h-5" />
                링크 정보 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {templateDetails ? (templateDetails.linkInfo.hasLinks ? 'YES' : 'NO') : linkSummary.hasLinks ? 'YES' : 'NO'}
                  </div>
                  <div className="text-sm text-gray-600">링크 포함</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {templateDetails ? templateDetails.linkInfo.totalLinkCount : linkSummary.totalButtons}
                  </div>
                  <div className="text-sm text-gray-600">총 버튼 수</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {templateDetails ? 
                      [...new Set(templateDetails.linkInfo.linkTypes.map(link => link.type))].length : 
                      linkSummary.buttonTypes}
                  </div>
                  <div className="text-sm text-gray-600">링크 유형 수</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 실제 버튼 정보 (CoolSMS API에서 가져온 데이터) */}
          {templateDetails && templateDetails.linkInfo.linkTypes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">버튼별 상세 정보</CardTitle>
                <p className="text-sm text-gray-600">CoolSMS API에서 실시간 조회된 정보입니다.</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {templateDetails.linkInfo.linkTypes.map((link, index) => {
                    const typeInfo = getButtonTypeInfo(link.type);
                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-full ${typeInfo.bgColor}`}>
                              <div className={typeInfo.color}>
                                {typeInfo.icon}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium">{link.name}</h4>
                              <Badge variant="secondary" className="text-xs">
                                {typeInfo.name} ({link.type})
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* 모바일 URL */}
                          {link.linkMo && (
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="text-sm font-medium text-gray-700">모바일 URL:</span>
                                <p className="text-sm text-gray-600 break-all">{link.linkMo}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(link.linkMo!)}
                                className="ml-2 flex-shrink-0"
                              >
                                {copiedUrl === link.linkMo ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          )}

                          {/* PC URL */}
                          {link.linkPc && (
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="text-sm font-medium text-gray-700">PC URL:</span>
                                <p className="text-sm text-gray-600 break-all">{link.linkPc}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(link.linkPc!)}
                                className="ml-2 flex-shrink-0"
                              >
                                {copiedUrl === link.linkPc ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Android 스킴 */}
                          {link.linkAnd && (
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="text-sm font-medium text-gray-700">Android 스킴:</span>
                                <p className="text-sm text-gray-600 break-all">{link.linkAnd}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(link.linkAnd!)}
                                className="ml-2 flex-shrink-0"
                              >
                                {copiedUrl === link.linkAnd ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          )}

                          {/* iOS 스킴 */}
                          {link.linkIos && (
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="text-sm font-medium text-gray-700">iOS 스킴:</span>
                                <p className="text-sm text-gray-600 break-all">{link.linkIos}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(link.linkIos!)}
                                className="ml-2 flex-shrink-0"
                              >
                                {copiedUrl === link.linkIos ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 안내사항 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">안내사항</div>
                  <ul className="space-y-1 text-xs">
                    <li>• 링크 정보는 CoolSMS API를 통해 실시간으로 조회됩니다</li>
                    <li>• 버튼 링크는 템플릿 승인 시 설정된 정보입니다</li>
                    <li>• 링크 수정은 카카오 비즈니스 채널에서 직접 해야 합니다</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 