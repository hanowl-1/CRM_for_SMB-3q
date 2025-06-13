'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Info, Database, Settings } from 'lucide-react';
import { WorkflowTestSettings } from '@/lib/types/workflow';
import DbVariableSettings from './db-variable-settings';

interface VariableSettingsProps {
  templateContent?: string;
  variables: Record<string, string>;
  testSettings: WorkflowTestSettings;
  onVariablesChange: (variables: Record<string, string>) => void;
  onTestSettingsChange: (settings: WorkflowTestSettings) => void;
}

export function VariableSettings({
  templateContent = '',
  variables,
  testSettings,
  onVariablesChange,
  onTestSettingsChange
}: VariableSettingsProps) {
  // 템플릿에서 변수 추출 (#{변수명} 형태)
  const extractVariablesFromTemplate = (content: string): string[] => {
    const matches = content.match(/#{([^}]+)}/g);
    if (!matches) return [];
    return [...new Set(matches.map(match => match.replace(/#{|}/g, '')))];
  };

  const templateVariables = extractVariablesFromTemplate(templateContent);
  const [newVariableKey, setNewVariableKey] = useState('');
  const [newVariableValue, setNewVariableValue] = useState('');

  const addVariable = () => {
    if (newVariableKey && newVariableValue) {
      onVariablesChange({
        ...variables,
        [newVariableKey]: newVariableValue
      });
      setNewVariableKey('');
      setNewVariableValue('');
    }
  };

  const removeVariable = (key: string) => {
    const newVariables = { ...variables };
    delete newVariables[key];
    onVariablesChange(newVariables);
  };

  const updateVariable = (key: string, value: string) => {
    onVariablesChange({
      ...variables,
      [key]: value
    });
  };

  const autoFillVariables = () => {
    const defaultValues: Record<string, string> = {
      '고객명': '홍길동',
      '회사명': '테스트 회사',
      '취소일': new Date().toLocaleDateString(),
      '구독상태': '활성',
      '실패사유': '카드 한도 초과',
      '다음결제일': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      '블로그제목': '새로운 비즈니스 전략',
      '콘텐츠제목': '마케팅 완벽 가이드',
      '콘텐츠설명': '효과적인 마케팅 전략을 알아보세요',
      '금액': '29,000원',
      '상품명': '프리미엄 플랜',
      '링크': 'https://example.com'
    };

    const autoFilledVariables: Record<string, string> = {};
    templateVariables.forEach(varName => {
      autoFilledVariables[varName] = defaultValues[varName] || `[${varName} 값]`;
    });

    onVariablesChange({
      ...variables,
      ...autoFilledVariables
    });
  };

  return (
    <div className="space-y-6">
      {/* 템플릿 변수 정보 */}
      {templateVariables.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">템플릿 변수</CardTitle>
              <Button onClick={autoFillVariables} variant="outline" size="sm">
                <Info className="w-4 h-4 mr-2" />
                자동 채우기
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {templateVariables.map(varName => (
                <Badge key={varName} variant="secondary">
                  #{varName}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              템플릿에서 발견된 변수들입니다. 아래에서 각 변수의 값을 설정해주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 변수 설정 탭 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">변수 값 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                수동 설정
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                DB 기반 설정
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="manual" className="space-y-4 mt-4">
              {/* 기존 변수들 */}
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">#{key}</Label>
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newVariables = { ...variables };
                          delete newVariables[key];
                          newVariables[e.target.value] = value;
                          onVariablesChange(newVariables);
                        }}
                        placeholder="변수명"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">값</Label>
                      <Input
                        value={value}
                        onChange={(e) => updateVariable(key, e.target.value)}
                        placeholder="변수 값"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariable(key)}
                    className="mt-6"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {/* 새 변수 추가 */}
              <div className="border-t pt-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">새 변수명</Label>
                      <Input
                        value={newVariableKey}
                        onChange={(e) => setNewVariableKey(e.target.value)}
                        placeholder="예: 고객명"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">값</Label>
                      <Input
                        value={newVariableValue}
                        onChange={(e) => setNewVariableValue(e.target.value)}
                        placeholder="예: 홍길동"
                      />
                    </div>
                  </div>
                  <Button onClick={addVariable} disabled={!newVariableKey || !newVariableValue}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="database" className="mt-4">
              <DbVariableSettings 
                onVariablesExtracted={(variables) => {
                  // 추출된 변수를 기존 변수와 병합
                  const stringVariables = Object.fromEntries(
                    Object.entries(variables).map(([key, value]) => [key, String(value)])
                  );
                  onVariablesChange({ ...variables, ...stringVariables });
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 테스트 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">테스트 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">테스트 전화번호</Label>
            <Input
              value={testSettings.testPhoneNumber}
              onChange={(e) => onTestSettingsChange({
                ...testSettings,
                testPhoneNumber: e.target.value
              })}
              placeholder="010-1234-5678"
            />
            <p className="text-xs text-muted-foreground mt-1">
              테스트 발송 시 사용할 전화번호를 입력하세요
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">테스트 모드</Label>
              <p className="text-xs text-muted-foreground">
                활성화 시 실제 발송 없이 시뮬레이션만 실행
              </p>
            </div>
            <Switch
              checked={testSettings.testMode}
              onCheckedChange={(checked) => onTestSettingsChange({
                ...testSettings,
                testMode: checked
              })}
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">테스트 메모</Label>
            <Textarea
              value={testSettings.testNotes}
              onChange={(e) => onTestSettingsChange({
                ...testSettings,
                testNotes: e.target.value
              })}
              placeholder="테스트 관련 메모를 입력하세요..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 