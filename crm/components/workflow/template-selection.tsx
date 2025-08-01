'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Search, 
  CheckCircle,
  Clock,
  Users,
  Star
} from 'lucide-react';

interface KakaoTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  variables?: string[];
  usage?: number;
  lastUsed?: string;
}

interface TemplateSelectionProps {
  selectedTemplate: KakaoTemplate | null;
  onTemplateSelect: (template: KakaoTemplate) => void;
}

// 샘플 템플릿 데이터
const sampleTemplates: KakaoTemplate[] = [
  {
    id: '114',
    name: '[슈퍼멤버스] [시장님] 1개월 성과 리포트 - 상위 블로거 참여 X',
    content: `안녕하세요 #companyName님!

이번 달 성과를 알려드립니다.

📊 이번 달 성과
• 총 리뷰 수: #total_reviews개
• 월간 리뷰 수: #monthly_review_count개  
• 총 포스트 조회수: #total_post_views회
• 네이버 플레이스 순위: #naver_place_rank위
• 블로그 포스트 순위: #blog_post_rank위

지속적인 성장을 위해 노력하겠습니다!

감사합니다.`,
    category: '성과 리포트',
    variables: ['#companyName', '#total_reviews', '#monthly_review_count', '#total_post_views', '#naver_place_rank', '#blog_post_rank'],
    usage: 1250,
    lastUsed: '2024-01-15'
  },
  {
    id: '115',
    name: '[슈퍼멤버스] 신규 고객 환영 메시지',
    content: `안녕하세요 #companyName님!

슈퍼멤버스에 가입해주셔서 감사합니다.

🎉 환영합니다!
• 계약 번호: #contractId
• 시작일: #startDate
• 담당자: #managerName

궁금한 점이 있으시면 언제든 연락주세요.

감사합니다.`,
    category: '환영 메시지',
    variables: ['#companyName', '#contractId', '#startDate', '#managerName'],
    usage: 890,
    lastUsed: '2024-01-14'
  },
  {
    id: '116',
    name: '[슈퍼멤버스] 계약 갱신 안내',
    content: `안녕하세요 #companyName님!

계약 갱신 시기가 다가왔습니다.

📅 계약 정보
• 현재 계약: #currentContract
• 만료일: #expiryDate
• 갱신 혜택: #renewalBenefit

갱신을 원하시면 연락주세요.

감사합니다.`,
    category: '계약 관리',
    variables: ['#companyName', '#currentContract', '#expiryDate', '#renewalBenefit'],
    usage: 456,
    lastUsed: '2024-01-13'
  },
  {
    id: '117',
    name: '[슈퍼멤버스] 이벤트 참여 안내',
    content: `안녕하세요 #companyName님!

특별 이벤트에 초대합니다.

🎁 이벤트 정보
• 이벤트명: #eventName
• 기간: #eventPeriod
• 혜택: #eventBenefit
• 참여 방법: #howToJoin

많은 참여 부탁드립니다!

감사합니다.`,
    category: '이벤트',
    variables: ['#companyName', '#eventName', '#eventPeriod', '#eventBenefit', '#howToJoin'],
    usage: 234,
    lastUsed: '2024-01-12'
  }
];

export function TemplateSelection({ selectedTemplate, onTemplateSelect }: TemplateSelectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTemplates, setFilteredTemplates] = useState<KakaoTemplate[]>(sampleTemplates);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 카테고리 목록 추출
  const categories = ['all', ...Array.from(new Set(sampleTemplates.map(t => t.category)))];

  // 검색 및 필터링
  useEffect(() => {
    let filtered = sampleTemplates;

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTemplates(filtered);
  }, [searchTerm, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '성과 리포트': return '📊';
      case '환영 메시지': return '🎉';
      case '계약 관리': return '📅';
      case '이벤트': return '🎁';
      default: return '📝';
    }
  };

  const formatUsage = (usage: number) => {
    if (usage >= 1000) {
      return `${(usage / 1000).toFixed(1)}k`;
    }
    return usage.toString();
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            카카오톡 템플릿 선택
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            발송할 메시지 템플릿을 선택하세요
          </p>
        </CardHeader>
      </Card>

      {/* 검색 및 필터 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 검색 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="템플릿 이름, 내용, 카테고리로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 카테고리 필터 */}
            <div className="flex gap-2 flex-wrap">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="text-xs"
                >
                  {category === 'all' ? '전체' : category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 템플릿 목록 */}
      <div className="grid gap-4">
        {filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">검색 결과가 없습니다</p>
                <p className="text-sm">다른 검색어나 카테고리를 시도해보세요</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredTemplates.map(template => (
            <Card 
              key={template.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate?.id === template.id 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onTemplateSelect(template)}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* 헤더 */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-lg leading-tight">
                          {template.name}
                        </h3>
                        {selectedTemplate?.id === template.id && (
                          <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>{getCategoryIcon(template.category)}</span>
                          <span>{template.category}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{formatUsage(template.usage || 0)} 사용</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>최근 {template.lastUsed}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 변수 표시 */}
                  {template.variables && template.variables.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">템플릿 변수:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map(variable => (
                          <Badge key={variable} variant="secondary" className="text-xs font-mono">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 미리보기 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2 text-muted-foreground">메시지 미리보기:</p>
                    <div className="text-sm leading-relaxed max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-sans">
                        {template.content.length > 200 
                          ? template.content.substring(0, 200) + '...'
                          : template.content
                        }
                      </pre>
                    </div>
                  </div>

                  {/* 선택 버튼 */}
                  <div className="flex justify-end">
                    <Button
                      variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTemplateSelect(template);
                      }}
                    >
                      {selectedTemplate?.id === template.id ? '선택됨' : '선택하기'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 선택된 템플릿 요약 */}
      {selectedTemplate && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-blue-500" />
              <div>
                <p className="font-medium text-blue-900">선택된 템플릿</p>
                <p className="text-sm text-blue-700">{selectedTemplate.name}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {selectedTemplate.variables?.length || 0}개의 변수 • {selectedTemplate.category}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 