'use client';

import { useState } from 'react';
import { WorkflowTrigger, WorkflowCondition } from '@/lib/types/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Zap } from 'lucide-react';

interface TriggerOption {
  value: string;
  label: string;
  description: string;
}

interface TriggerSettingsProps {
  trigger: WorkflowTrigger;
  onTriggerChange: (trigger: WorkflowTrigger) => void;
  options: TriggerOption[];
}

const fieldOptions = [
  { value: 'user.email', label: '이메일' },
  { value: 'user.name', label: '이름' },
  { value: 'user.phone', label: '전화번호' },
  { value: 'user.status', label: '회원 상태' },
  { value: 'subscription.plan', label: '구독 플랜' },
  { value: 'subscription.status', label: '구독 상태' },
  { value: 'payment.amount', label: '결제 금액' },
  { value: 'payment.method', label: '결제 방법' },
  { value: 'order.count', label: '주문 횟수' },
  { value: 'custom.tag', label: '사용자 태그' },
];

const operatorOptions = [
  { value: 'equals', label: '같음 (=)' },
  { value: 'not_equals', label: '다름 (≠)' },
  { value: 'contains', label: '포함' },
  { value: 'greater_than', label: '초과 (>)' },
  { value: 'less_than', label: '미만 (<)' },
  { value: 'exists', label: '존재함' },
  { value: 'not_exists', label: '존재하지 않음' },
];

export function TriggerSettings({ trigger, onTriggerChange, options }: TriggerSettingsProps) {
  const addCondition = () => {
    console.log('조건 추가 버튼 클릭됨');
    console.log('현재 trigger:', trigger);
    
    const newCondition: WorkflowCondition = {
      id: `condition_${Date.now()}`,
      field: 'user.email',
      operator: 'equals',
      value: ''
    };

    const updatedTrigger = {
      ...trigger,
      conditions: [...(trigger.conditions || []), newCondition],
      conditionLogic: trigger.conditionLogic || 'AND'
    };

    console.log('업데이트된 trigger:', updatedTrigger);
    onTriggerChange(updatedTrigger);
  };

  const updateCondition = (conditionId: string, updates: Partial<WorkflowCondition>) => {
    const updatedConditions = (trigger.conditions || []).map(condition =>
      condition.id === conditionId ? { ...condition, ...updates } : condition
    );

    onTriggerChange({
      ...trigger,
      conditions: updatedConditions
    });
  };

  const removeCondition = (conditionId: string) => {
    const updatedConditions = (trigger.conditions || []).filter(
      condition => condition.id !== conditionId
    );

    onTriggerChange({
      ...trigger,
      conditions: updatedConditions
    });
  };

  const updateTriggerType = (value: string) => {
    const option = options.find(opt => opt.value === value);
    if (option) {
      onTriggerChange({
        ...trigger,
        type: value as any,
        name: option.label,
        description: option.description
      });
    }
  };

  const updateConditionLogic = (logic: 'AND' | 'OR') => {
    onTriggerChange({
      ...trigger,
      conditionLogic: logic
    });
  };

  return (
    <div className="space-y-4">
      {/* 기본 트리거 선택 */}
      <div>
        <label className="text-sm font-medium mb-2 block">언제 실행할까요?</label>
        <Select value={trigger.type} onValueChange={updateTriggerType}>
          <SelectTrigger>
            <SelectValue placeholder="트리거 선택" />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 추가 조건 설정 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium">추가 조건 (선택사항)</label>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('버튼 클릭 이벤트 발생');
              addCondition();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="button"
          >
            <Plus className="w-4 h-4" />
            조건 추가
          </button>
        </div>

        {trigger.conditions && trigger.conditions.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* 논리 연산자 선택 */}
              {trigger.conditions.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">조건 연결:</span>
                  <Select
                    value={trigger.conditionLogic || 'AND'}
                    onValueChange={(value) => updateConditionLogic(value as 'AND' | 'OR')}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {trigger.conditionLogic === 'AND' ? '모든 조건을 만족' : '하나 이상의 조건을 만족'}
                  </span>
                </div>
              )}

              {/* 조건 목록 */}
              {trigger.conditions.map((condition, index) => (
                <div key={condition.id} className="space-y-2">
                  {index > 0 && (
                    <div className="flex items-center justify-center">
                      <Badge variant="outline" className="text-xs">
                        {trigger.conditionLogic || 'AND'}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      {/* 필드 선택 */}
                      <Select
                        value={condition.field}
                        onValueChange={(value) => updateCondition(condition.id, { field: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="필드 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions.map(field => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* 연산자 선택 */}
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(condition.id, { operator: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="연산자" />
                        </SelectTrigger>
                        <SelectContent>
                          {operatorOptions.map(op => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* 값 입력 */}
                      {!['exists', 'not_exists'].includes(condition.operator) && (
                        <Input
                          value={condition.value}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          placeholder="값 입력"
                        />
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(condition.id)}
                      title="조건 삭제"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(!trigger.conditions || trigger.conditions.length === 0) && (
          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">추가 조건이 없습니다</p>
            <p className="text-xs">기본 트리거만으로 워크플로우가 실행됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
} 