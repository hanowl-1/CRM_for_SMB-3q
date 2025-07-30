"use client";

import { useState, useEffect } from "react";
import { TargetGroup, FilterCondition } from "@/lib/types/workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Users,
  Database,
  Code,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

interface TargetSelectionProps {
  onTargetsChange: (targets: TargetGroup[]) => void;
  currentTargets: TargetGroup[];
  triggerType: "manual" | "webhook";
}

export function TargetSelection({
  onTargetsChange,
  currentTargets,
  triggerType,
}: TargetSelectionProps) {
  const [targets, setTargets] = useState<TargetGroup[]>(currentTargets);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "static" | "dynamic" | "automation"
  >(triggerType === "manual" ? "static" : "automation");

  // 정적 대상 선정 상태
  const [staticName, setStaticName] = useState("");
  const [staticTable, setStaticTable] = useState("");
  const [staticConditions, setStaticConditions] = useState<FilterCondition[]>(
    []
  );

  // 동적 대상 선정 상태
  const [dynamicName, setDynamicName] = useState("");
  const [dynamicDescription, setDynamicDescription] = useState("");
  const [dynamicSql, setDynamicSql] = useState("");
  const [dynamicFields, setDynamicFields] = useState("contact, name, id");
  const [queryTestResult, setQueryTestResult] = useState<any>(null);
  const [isTestingQuery, setIsTestingQuery] = useState(false);

  // 자동화 대상 선정 상태
  const [automationName, setAutomationName] = useState("");
  const [automationEvent, setAutomationEvent] = useState("");

  // 새로운 상태: 컬럼 선택
  const [contactColumn, setContactColumn] = useState("");
  const [mappingColumns, setMappingColumns] = useState<string[]>([]);

  const [availableTables, setAvailableTables] = useState<string[]>([]);

  console.log("targets", targets);

  useEffect(() => {
    // 사용 가능한 테이블 목록 로드
    fetchAvailableTables();
  }, []);

  useEffect(() => {
    onTargetsChange(targets);
  }, [targets, onTargetsChange]);

  const fetchAvailableTables = async () => {
    try {
      const response = await fetch("/api/mysql/table-mappings");
      if (response.ok) {
        const data = await response.json();
        // mappings는 객체이므로 Object.values()를 사용하여 배열로 변환
        if (data.mappings && typeof data.mappings === "object") {
          const tableNames = Object.values(data.mappings).map(
            (mapping: any) => mapping.tableName
          );
          setAvailableTables(tableNames);
        } else {
          console.warn("테이블 매핑 데이터가 객체가 아닙니다:", data);
          setAvailableTables([]);
        }
      }
    } catch (error) {
      console.error("테이블 목록 로드 실패:", error);
      setAvailableTables([]);
    }
  };

  const testDynamicQuery = async () => {
    if (!dynamicSql.trim()) return;

    setIsTestingQuery(true);
    setQueryTestResult(null); // 이전 결과 완전 초기화

    try {
      console.log("동적 쿼리 테스트 시작:", dynamicSql);

      const response = await fetch("/api/mysql/targets/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "custom_query",
          query: dynamicSql,
          limit: 5,
        }),
      });

      console.log("응답 상태:", response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log("쿼리 테스트 결과:", result);
        setQueryTestResult(result);
      } else {
        const errorText = await response.text();
        console.error("API 오류 응답:", errorText);

        let errorMessage = "쿼리 실행에 실패했습니다";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (parseError) {
          if (response.status === 400) {
            errorMessage = "SQL 쿼리 문법을 확인해주세요";
          } else if (response.status === 500) {
            errorMessage = "데이터베이스 연결 오류가 발생했습니다";
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }

        setQueryTestResult({
          success: false,
          error: errorMessage,
        });
      }
    } catch (error) {
      console.error("네트워크 오류:", error);
      setQueryTestResult({
        success: false,
        error: "네트워크 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    } finally {
      setIsTestingQuery(false);
    }
  };

  const addStaticTarget = () => {
    if (!staticName.trim() || !staticTable) return;

    const newTarget: TargetGroup = {
      id: `target_${Date.now()}`,
      name: staticName,
      type: "static",
      table: staticTable,
      conditions: staticConditions,
      estimatedCount: 0,
    };

    setTargets([...targets, newTarget]);
    resetStaticForm();
    setShowAddDialog(false);
  };

  const addDynamicTarget = () => {
    if (!dynamicName.trim() || !dynamicSql.trim()) return;

    const newTarget: TargetGroup = {
      id: `target_${Date.now()}`,
      name: dynamicName,
      type: "dynamic",
      dynamicQuery: {
        sql: dynamicSql,
        description: dynamicDescription,
        expectedFields: dynamicFields.split(",").map((f) => f.trim()),
        lastExecuted: undefined,
        lastCount: queryTestResult?.totalCount || 0,
        contactColumn: contactColumn || undefined,
        mappingColumns: mappingColumns.length > 0 ? mappingColumns : undefined,
      },
      estimatedCount: queryTestResult?.totalCount || 0,
    };

    setTargets([...targets, newTarget]);
    resetDynamicForm();
    setShowAddDialog(false);
  };

  // 자동화 대상 선정 함수
  const addAutomationTarget = () => {
    if (!automationName.trim() || !automationEvent) return;

    const newTarget: TargetGroup = {
      id: `automation_${Date.now()}`,
      name: automationName,
      type: "automation",
      automationQuery: {
        event: automationEvent as "lead_created" | "signup",
        eventName: getEventName(automationEvent),
      },
      estimatedCount: 0, // 자동화는 실시간이므로 0
    };

    setTargets([...targets, newTarget]);
    resetAutomationForm();
    setShowAddDialog(false);
  };

  const getEventName = (event: string) => {
    const eventNames = {
      lead_created: "도입문의 완료",
      signup: "회원가입 완료",
    };
    return eventNames[event] || event;
  };

  const resetAutomationForm = () => {
    setAutomationName("");
    setAutomationEvent("");
  };

  const resetStaticForm = () => {
    setStaticName("");
    setStaticTable("");
    setStaticConditions([]);
  };

  const resetDynamicForm = () => {
    setDynamicName("");
    setDynamicDescription("");
    setDynamicSql("");
    setDynamicFields("contact, name, id");
    setQueryTestResult(null);
    setIsTestingQuery(false);
    setContactColumn("");
    setMappingColumns([]);
  };

  const removeTarget = (targetId: string) => {
    setTargets(targets.filter((t) => t.id !== targetId));
  };

  const addStaticCondition = () => {
    const newCondition: FilterCondition = {
      field: "",
      operator: "equals",
      value: "",
    };
    setStaticConditions([...staticConditions, newCondition]);
  };

  const updateStaticCondition = (
    index: number,
    updates: Partial<FilterCondition>
  ) => {
    const updatedConditions = staticConditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    );
    setStaticConditions(updatedConditions);
  };

  const removeStaticCondition = (index: number) => {
    setStaticConditions(staticConditions.filter((_, i) => i !== index));
  };

  // 예시 쿼리 템플릿
  const queryTemplates = [
    {
      name: "월간 리포트 대상자",
      description: "광고 시작일이 오늘인 고객",
      sql: `SELECT 
  ad.id as adId,
  cp.contacts as contact,
  cp.name as companyName,
  COUNT(ct.id) as contractCount
FROM Ads ad
JOIN Companies cp ON cp.id = ad.companyId 
  AND cp.contacts IS NOT NULL
JOIN Ads_Payment ap ON ap.adId = ad.id
JOIN Contracts ct ON ad.id = ct.company 
  AND ct.currentState >= 1
WHERE ap.adsStart = DATE(NOW())
GROUP BY ad.id, cp.contacts, cp.name`,
    },
    {
      name: "VIP 고객",
      description: "계약 수 10개 이상인 고객",
      sql: `SELECT 
  cp.contacts as contact,
  cp.name as companyName,
  COUNT(ct.id) as contractCount
FROM Companies cp
JOIN Ads ad ON ad.companyId = cp.id
JOIN Contracts ct ON ct.company = ad.id
WHERE cp.contacts IS NOT NULL
  AND ct.currentState >= 1
GROUP BY cp.id, cp.contacts, cp.name
HAVING COUNT(ct.id) >= 10`,
    },
    {
      name: "신규 가입 고객",
      description: "최근 7일 내 가입한 고객",
      sql: `SELECT 
  contacts as contact,
  name as companyName,
  createdAt
FROM Companies 
WHERE contacts IS NOT NULL
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                발송 대상 선정
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                알림톡을 받을 대상자를 설정하세요
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              대상 그룹 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                설정된 대상 그룹이 없습니다
              </p>
              <p className="text-sm mb-4">
                알림톡을 받을 대상자 그룹을 추가해주세요
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />첫 번째 대상 그룹 추가
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        target.type === "dynamic"
                          ? "bg-purple-100 text-purple-600"
                          : target.type === "automation"
                          ? "bg-orange-100 text-orange-600" // 자동화 색상 추가
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {target.type === "dynamic" ? (
                        <Code className="w-4 h-4" />
                      ) : target.type === "automation" ? (
                        <Play className="w-4 h-4" /> // 자동화 아이콘 추가
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{target.name}</h4>
                      <Badge
                        variant={
                          target.type === "dynamic"
                            ? "default"
                            : target.type === "automation"
                            ? "outline" // 자동화 배지 스타일
                            : "secondary"
                        }
                        className={
                          target.type === "automation"
                            ? "bg-orange-50 text-orange-700 border-orange-200" // 자동화 색상
                            : ""
                        }
                      >
                        {target.type === "dynamic"
                          ? "동적 쿼리"
                          : target.type === "automation"
                          ? "자동화" // 자동화 텍스트
                          : "정적 조건"}
                      </Badge>
                      <Badge variant="outline">
                        약 {(target.estimatedCount || 0).toLocaleString()}명
                      </Badge>
                    </div>

                    {target.type === "static" ? (
                      <div className="text-sm text-muted-foreground">
                        <p>테이블: {target.table}</p>
                        <p>조건: {target.conditions?.length || 0}개</p>
                      </div>
                    ) : target.type === "automation" ? (
                      // 자동화 정보 표시 추가
                      <div className="text-sm text-muted-foreground">
                        <p>
                          이벤트:
                          {target.automationQuery?.eventName || "미설정"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Play className="w-3 h-3" />
                          <span>실시간 트리거 대기 중</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>{target.dynamicQuery?.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {target.dynamicQuery?.lastExecuted
                              ? `마지막 실행: ${new Date(
                                  target.dynamicQuery.lastExecuted
                                ).toLocaleString()}`
                              : "아직 실행되지 않음"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTarget(target.id)}
                    title="대상 그룹 제거"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 대상 그룹 추가 다이얼로그 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>대상 그룹 추가</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "static" | "dynamic" | "automation")
            }
          >
            <TabsList
              className={`grid w-full ${
                triggerType === "manual" ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {triggerType === "manual" ? (
                <>
                  <TabsTrigger
                    value="static"
                    className="flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    정적 조건
                  </TabsTrigger>
                  <TabsTrigger
                    value="dynamic"
                    className="flex items-center gap-2"
                  >
                    <Code className="w-4 h-4" />
                    동적 쿼리
                  </TabsTrigger>
                </>
              ) : (
                <TabsTrigger
                  value="automation"
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  자동화
                </TabsTrigger>
              )}
            </TabsList>

            {triggerType === "manual" ? (
              <>
                {/* 정적 조건 */}
                <TabsContent value="static" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      그룹 이름 *
                    </label>
                    <Input
                      value={staticName}
                      onChange={(e) => setStaticName(e.target.value)}
                      placeholder="예: VIP 고객"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      테이블 선택 *
                    </label>
                    <Select value={staticTable} onValueChange={setStaticTable}>
                      <SelectTrigger>
                        <SelectValue placeholder="테이블을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTables.map((table) => (
                          <SelectItem key={table} value={table}>
                            {table}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">필터 조건</label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addStaticCondition}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        조건 추가
                      </Button>
                    </div>

                    {staticConditions.map((condition, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 border rounded-lg mb-2"
                      >
                        <Input
                          placeholder="필드명"
                          value={condition.field}
                          onChange={(e) =>
                            updateStaticCondition(index, {
                              field: e.target.value,
                            })
                          }
                          className="flex-1"
                        />
                        <Select
                          value={condition.operator}
                          onValueChange={(value) =>
                            updateStaticCondition(index, {
                              operator: value as any,
                            })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">같음</SelectItem>
                            <SelectItem value="contains">포함</SelectItem>
                            <SelectItem value="greater_than">초과</SelectItem>
                            <SelectItem value="less_than">미만</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="값"
                          value={condition.value}
                          onChange={(e) =>
                            updateStaticCondition(index, {
                              value: e.target.value,
                            })
                          }
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStaticCondition(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={addStaticTarget}
                      disabled={!staticName.trim() || !staticTable}
                    >
                      추가
                    </Button>
                  </div>
                </TabsContent>

                {/* 동적 쿼리 */}
                <TabsContent value="dynamic" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      그룹 이름 *
                    </label>
                    <Input
                      value={dynamicName}
                      onChange={(e) => setDynamicName(e.target.value)}
                      placeholder="예: 월간 리포트 대상자"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      설명
                    </label>
                    <Input
                      value={dynamicDescription}
                      onChange={(e) => setDynamicDescription(e.target.value)}
                      placeholder="이 쿼리가 어떤 대상자를 선택하는지 설명"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">SQL 쿼리 *</label>
                      <div className="flex gap-2">
                        <Select
                          onValueChange={(value) => {
                            const template = queryTemplates.find(
                              (t) => t.name === value
                            );
                            if (template) {
                              setDynamicSql(template.sql);
                              setDynamicDescription(template.description);
                            }
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="템플릿 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {queryTemplates.map((template) => (
                              <SelectItem
                                key={template.name}
                                value={template.name}
                              >
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={testDynamicQuery}
                          disabled={!dynamicSql.trim() || isTestingQuery}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          {isTestingQuery ? "테스트 중..." : "쿼리 테스트"}
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={dynamicSql}
                      onChange={(e) => {
                        setDynamicSql(e.target.value);
                        // 쿼리가 변경되면 이전 테스트 결과 초기화
                        if (queryTestResult) {
                          setQueryTestResult(null);
                        }
                      }}
                      placeholder="SELECT contact, name FROM Companies WHERE ..."
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      예상 결과 필드
                    </label>
                    <Input
                      value={dynamicFields}
                      onChange={(e) => setDynamicFields(e.target.value)}
                      placeholder="contact, name, id"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      쿼리 결과에 포함될 필드명을 쉼표로 구분하여 입력 (contact
                      필드는 필수)
                    </p>
                  </div>

                  {/* 쿼리 테스트 결과 */}
                  {queryTestResult && (
                    <div className="space-y-4">
                      {queryTestResult.success ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <h4 className="font-medium text-green-800">
                              쿼리 테스트 성공
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="text-sm text-green-700">
                              <p>
                                조회된 데이터:{" "}
                                <strong>{queryTestResult.totalCount}개</strong>
                              </p>
                              <p>
                                미리보기: {queryTestResult.preview?.length || 0}
                                개 행
                              </p>
                            </div>

                            {queryTestResult.preview &&
                              queryTestResult.preview.length > 0 && (
                                <div className="text-sm">
                                  <p className="font-medium text-green-800 mb-2">
                                    사용 가능한 컬럼:
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.keys(
                                      queryTestResult.preview[0]
                                    ).map((column) => (
                                      <Badge
                                        key={column}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {column}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>

                          {/* 컬럼 선택 섹션 */}
                          {queryTestResult.preview &&
                            queryTestResult.preview.length > 0 && (
                              <div className="space-y-4 pt-4 border-t border-green-200">
                                <h5 className="font-medium text-green-800">
                                  컬럼 설정
                                </h5>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* 연락처 컬럼 선택 */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      연락처 컬럼 *
                                    </label>
                                    <Select
                                      value={contactColumn}
                                      onValueChange={setContactColumn}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="연락처로 사용할 컬럼 선택" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.keys(
                                          queryTestResult.preview[0]
                                        ).map((column) => (
                                          <SelectItem
                                            key={column}
                                            value={column}
                                          >
                                            <div className="flex items-center justify-between w-full">
                                              <span>{column}</span>
                                              <span className="text-xs text-muted-foreground ml-2">
                                                {String(
                                                  queryTestResult.preview[0][
                                                    column
                                                  ]
                                                )}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500 mt-1">
                                      메시지 발송 시 사용할 연락처 정보가
                                      들어있는 컬럼
                                    </p>
                                  </div>

                                  {/* 매핑용 컬럼 선택 */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      매핑용 컬럼 (선택사항)
                                    </label>
                                    <div className="space-y-2">
                                      {Object.keys(
                                        queryTestResult.preview[0]
                                      ).map((column) => (
                                        <div
                                          key={column}
                                          className="flex items-center gap-2"
                                        >
                                          <input
                                            type="checkbox"
                                            id={`mapping-${column}`}
                                            checked={mappingColumns.includes(
                                              column
                                            )}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setMappingColumns([
                                                  ...mappingColumns,
                                                  column,
                                                ]);
                                              } else {
                                                setMappingColumns(
                                                  mappingColumns.filter(
                                                    (c) => c !== column
                                                  )
                                                );
                                              }
                                            }}
                                            className="rounded border-gray-300"
                                          />
                                          <label
                                            htmlFor={`mapping-${column}`}
                                            className="text-sm cursor-pointer flex items-center gap-2"
                                          >
                                            <span>{column}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {String(
                                                queryTestResult.preview[0][
                                                  column
                                                ]
                                              )}
                                            </span>
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      개인화 변수에 사용할 수 있는 컬럼들을
                                      선택하세요
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* 데이터 미리보기 */}
                          {queryTestResult.preview &&
                            queryTestResult.preview.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-green-200">
                                <h5 className="font-medium text-green-800 mb-2">
                                  데이터 미리보기
                                </h5>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead>
                                      <tr className="bg-green-100">
                                        {Object.keys(
                                          queryTestResult.preview[0]
                                        ).map((key) => (
                                          <th
                                            key={key}
                                            className="px-2 py-1 text-left font-medium text-green-800"
                                          >
                                            {key}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {queryTestResult.preview
                                        .slice(0, 3)
                                        .map((row, index) => (
                                          <tr
                                            key={index}
                                            className="border-b border-green-100"
                                          >
                                            {Object.values(row).map(
                                              (value, colIndex) => (
                                                <td
                                                  key={colIndex}
                                                  className="px-2 py-1 text-green-700"
                                                >
                                                  {String(value)}
                                                </td>
                                              )
                                            )}
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <h4 className="font-medium text-red-800">
                              쿼리 테스트 실패
                            </h4>
                          </div>

                          <p className="text-sm text-red-700">
                            {queryTestResult.error}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                    >
                      취소
                    </Button>
                    <Button
                      onClick={addDynamicTarget}
                      disabled={
                        !dynamicName.trim() ||
                        !dynamicSql.trim() ||
                        !queryTestResult?.success ||
                        !contactColumn
                      }
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      동적 대상 그룹 추가
                    </Button>
                  </div>
                </TabsContent>
              </>
            ) : (
              // 자동화 대상
              <TabsContent value="automation" className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    그룹 이름 *
                  </label>
                  <Input
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="예: 도입문의 고객"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    이벤트 트리거 *
                  </label>
                  <Select
                    value={automationEvent}
                    onValueChange={setAutomationEvent}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="트리거 이벤트를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead_created">
                        도입문의 완료
                      </SelectItem>
                      <SelectItem value="signup">회원가입 완료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={addAutomationTarget}
                    disabled={!automationName.trim() || !automationEvent}
                  >
                    추가
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
