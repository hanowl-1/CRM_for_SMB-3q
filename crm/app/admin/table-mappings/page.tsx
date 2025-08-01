'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Target, 
  Megaphone, 
  FileText, 
  Radio,
  Database,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Table,
  Columns,
  Code,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const ICON_MAP = {
  Building2,
  Target,
  Megaphone,
  FileText,
  Radio,
  Database,
  Table
};

const FIELD_TYPES = [
  { value: 'text', label: '텍스트' },
  { value: 'number', label: '숫자' },
  { value: 'email', label: '이메일' },
  { value: 'phone', label: '전화번호' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: '날짜' },
  { value: 'datetime', label: '날짜시간' },
  { value: 'boolean', label: '참/거짓' },
  { value: 'select', label: '선택' }
];

// 타입 정의
interface TableField {
  displayName: string;
  description: string;
  type: string;
  filterable: boolean;
}

interface TableMapping {
  tableName: string;
  displayName: string;
  description: string;
  icon: string;
  enabled: boolean;
  fields: Record<string, TableField>;
  updatedAt?: string;
}

interface DatabaseTable {
  tableName: string;
  tableComment: string;
  estimatedRows: number;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseColumn {
  columnName: string;
  dataType: string;
  isNullable: string;
  defaultValue: string | null;
  columnComment: string;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  columnKey: string;
  extra: string;
}

export default function TableMappingsPage() {
  const [mappings, setMappings] = useState<Record<string, TableMapping>>({});
  const [allTables, setAllTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<DatabaseColumn[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMapping, setEditingMapping] = useState<TableMapping | null>(null);

  // 매핑 데이터 로드
  const loadMappings = async () => {
    try {
      const response = await fetch('/api/mysql/table-mappings');
      const data = await response.json();
      if (data.success) {
        setMappings(data.mappings);
      }
    } catch (error) {
      console.error('매핑 로드 오류:', error);
      toast.error('매핑 데이터를 불러오는데 실패했습니다.');
    }
  };

  // 모든 테이블 목록 로드
  const loadAllTables = async () => {
    try {
      const response = await fetch('/api/mysql/schema?action=tables');
      const data = await response.json();
      if (data.success) {
        setAllTables(data.tables);
      }
    } catch (error) {
      console.error('테이블 목록 로드 오류:', error);
      toast.error('테이블 목록을 불러오는데 실패했습니다.');
    }
  };

  // 특정 테이블의 컬럼 정보 로드
  const loadTableColumns = async (tableName: string) => {
    try {
      const response = await fetch(`/api/mysql/schema?action=columns&table=${tableName}`);
      const data = await response.json();
      if (data.success) {
        setTableColumns(data.columns);
        setSampleData(data.sampleData);
        setSelectedTable(tableName);
      }
    } catch (error) {
      console.error('테이블 컬럼 로드 오류:', error);
      toast.error('테이블 정보를 불러오는데 실패했습니다.');
    }
  };

  // 매핑 저장
  const saveMapping = async (tableName: string, mapping: TableMapping) => {
    setSaving(true);
    try {
      const response = await fetch('/api/mysql/table-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          tableName,
          mapping
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadMappings();
        setEditingMapping(null);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('매핑 저장 오류:', error);
      toast.error('매핑 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 매핑 토글
  const toggleMapping = async (tableName: string) => {
    try {
      const response = await fetch('/api/mysql/table-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          tableName
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadMappings();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('매핑 토글 오류:', error);
      toast.error('매핑 상태 변경에 실패했습니다.');
    }
  };

  // 매핑 삭제
  const deleteMapping = async (tableName: string) => {
    if (!confirm(`${tableName} 매핑을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch('/api/mysql/table-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          tableName
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        await loadMappings();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error('매핑 삭제 오류:', error);
      toast.error('매핑 삭제에 실패했습니다.');
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([loadMappings(), loadAllTables()]);
      setLoading(false);
    };
    initData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">테이블 매핑 관리</h1>
          <p className="text-muted-foreground">
            MySQL 테이블과 필드를 워크플로우 변수로 매핑하여 관리합니다.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
        <Button onClick={() => loadMappings()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      <Tabs defaultValue="mappings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mappings">현재 매핑</TabsTrigger>
          <TabsTrigger value="tables">테이블 탐색</TabsTrigger>
          <TabsTrigger value="create">새 매핑 생성</TabsTrigger>
        </TabsList>

        {/* 현재 매핑 탭 */}
        <TabsContent value="mappings" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(mappings).map(([tableName, mapping]) => {
              const IconComponent = ICON_MAP[mapping.icon as keyof typeof ICON_MAP] || Database;
              const fieldCount = Object.keys(mapping.fields || {}).length;
              
              return (
                <Card key={tableName} className={`transition-all ${mapping.enabled ? '' : 'opacity-60'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="h-6 w-6" />
                        <div>
                          <CardTitle className="flex items-center space-x-2">
                            <span>{mapping.displayName}</span>
                            <Badge variant={mapping.enabled ? 'default' : 'secondary'}>
                              {mapping.enabled ? '활성' : '비활성'}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{mapping.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{fieldCount}개 필드</Badge>
                        <Switch
                          checked={mapping.enabled}
                          onCheckedChange={() => toggleMapping(tableName)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMapping({ ...mapping, tableName })}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMapping(tableName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {Object.entries(mapping.fields || {}).map(([fieldName, field]) => (
                        <div key={fieldName} className="p-2 bg-muted rounded-md">
                          <div className="font-medium text-sm">{field.displayName}</div>
                          <div className="text-xs text-muted-foreground">{fieldName}</div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* 테이블 탐색 탭 */}
        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>데이터베이스 테이블 ({allTables.length}개)</span>
              </CardTitle>
              <CardDescription>
                MySQL 데이터베이스의 모든 테이블을 탐색하고 구조를 확인할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {allTables.map((table) => (
                  <div
                    key={table.tableName}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                      selectedTable === table.tableName ? 'bg-muted border-primary' : ''
                    }`}
                    onClick={() => loadTableColumns(table.tableName)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{table.tableName}</div>
                        <div className="text-sm text-muted-foreground">
                          {table.tableComment || '설명 없음'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          ~{table.estimatedRows?.toLocaleString() || 0}행
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mappings[table.tableName] ? '매핑됨' : '미매핑'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 선택된 테이블의 상세 정보 */}
          {selectedTable && tableColumns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Columns className="h-5 w-5" />
                  <span>{selectedTable} 테이블 구조</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {tableColumns.map((column) => (
                    <div key={column.columnName} className="p-2 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{column.columnName}</div>
                          <div className="text-sm text-muted-foreground">
                            {column.columnComment || '설명 없음'}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{column.dataType}</Badge>
                          {column.columnKey === 'PRI' && (
                            <Badge variant="default" className="ml-1">PK</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {sampleData.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">샘플 데이터</h4>
                    <ScrollArea className="h-32 border rounded">
                      <div className="p-2 text-xs">
                        <pre>{JSON.stringify(sampleData, null, 2)}</pre>
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <Button
                  onClick={() => setEditingMapping({
                    tableName: selectedTable,
                    displayName: selectedTable,
                    description: '',
                    icon: 'Database',
                    enabled: true,
                    fields: {}
                  })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  이 테이블로 매핑 생성
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 새 매핑 생성 탭 */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>새 테이블 매핑 생성</CardTitle>
              <CardDescription>
                새로운 테이블 매핑을 생성하거나 기존 매핑을 수정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setEditingMapping({
                  tableName: '',
                  displayName: '',
                  description: '',
                  icon: 'Database',
                  enabled: true,
                  fields: {}
                })}
              >
                <Plus className="h-4 w-4 mr-2" />
                새 매핑 생성
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 매핑 편집 다이얼로그 */}
      {editingMapping && (
        <MappingEditDialog
          mapping={editingMapping}
          onSave={saveMapping}
          onClose={() => setEditingMapping(null)}
          saving={saving}
          allTables={allTables}
          onLoadTableColumns={loadTableColumns}
          tableColumns={tableColumns}
        />
      )}
    </div>
  );
}

// 매핑 편집 다이얼로그 컴포넌트
interface MappingEditDialogProps {
  mapping: TableMapping;
  onSave: (tableName: string, mapping: TableMapping) => void;
  onClose: () => void;
  saving: boolean;
  allTables: DatabaseTable[];
  onLoadTableColumns: (tableName: string) => Promise<void>;
  tableColumns: DatabaseColumn[];
}

function MappingEditDialog({ 
  mapping, 
  onSave, 
  onClose, 
  saving, 
  allTables, 
  onLoadTableColumns, 
  tableColumns 
}: MappingEditDialogProps) {
  const [editData, setEditData] = useState<TableMapping>(mapping);
  const [selectedColumns, setSelectedColumns] = useState<DatabaseColumn[]>([]);

  const handleSave = () => {
    if (!editData.tableName || !editData.displayName) {
      toast.error('테이블명과 표시명은 필수입니다.');
      return;
    }
    onSave(editData.tableName, editData);
  };

  const addField = (columnName = '', field: Partial<TableField> = {}) => {
    const newFields = { ...editData.fields };
    const fieldName = columnName || `field_${Date.now()}`;
    newFields[fieldName] = {
      displayName: field.displayName || '',
      description: field.description || '',
      type: field.type || 'text',
      filterable: field.filterable !== false
    };
    setEditData({ ...editData, fields: newFields });
  };

  const removeField = (fieldName: string) => {
    const newFields = { ...editData.fields };
    delete newFields[fieldName];
    setEditData({ ...editData, fields: newFields });
  };

  const updateField = (fieldName: string, updates: Partial<TableField>) => {
    const newFields = { ...editData.fields };
    newFields[fieldName] = { ...newFields[fieldName], ...updates };
    setEditData({ ...editData, fields: newFields });
  };

  // 테이블 선택 시 컬럼 로드
  const handleTableSelect = async (tableName: string) => {
    setEditData({ ...editData, tableName });
    await onLoadTableColumns(tableName);
  };

  // 선택된 컬럼들을 필드로 추가
  const addSelectedColumns = () => {
    selectedColumns.forEach(column => {
      const fieldType = getFieldTypeFromColumn(column);
      addField(column.columnName, {
        displayName: column.columnComment || column.columnName,
        description: `${column.dataType} 타입의 ${column.columnName} 필드`,
        type: fieldType,
        filterable: true
      });
    });
    setSelectedColumns([]);
  };

  // 컬럼 타입에서 필드 타입 추론
  const getFieldTypeFromColumn = (column: DatabaseColumn): string => {
    const dataType = column.dataType.toLowerCase();
    if (dataType.includes('int') || dataType.includes('decimal') || dataType.includes('float')) {
      return 'number';
    }
    if (dataType.includes('date')) {
      return dataType.includes('time') ? 'datetime' : 'date';
    }
    if (dataType.includes('bool') || dataType.includes('tinyint(1)')) {
      return 'boolean';
    }
    if (column.columnName.toLowerCase().includes('email')) {
      return 'email';
    }
    if (column.columnName.toLowerCase().includes('phone') || column.columnName.toLowerCase().includes('tel')) {
      return 'phone';
    }
    if (column.columnName.toLowerCase().includes('url') || column.columnName.toLowerCase().includes('link')) {
      return 'url';
    }
    return 'text';
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mapping.tableName ? '매핑 수정' : '새 매핑 생성'}
          </DialogTitle>
          <DialogDescription>
            테이블 매핑 정보를 설정하고 필드를 구성하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">테이블명</Label>
              <Select
                value={editData.tableName}
                onValueChange={handleTableSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="테이블 선택" />
                </SelectTrigger>
                <SelectContent>
                  {allTables.map(table => (
                    <SelectItem key={table.tableName} value={table.tableName}>
                      {table.tableName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">표시명</Label>
              <Input
                id="displayName"
                value={editData.displayName}
                onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                placeholder="사용자에게 표시될 이름"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="테이블에 대한 설명"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">아이콘</Label>
              <Select
                value={editData.icon}
                onValueChange={(value) => setEditData({ ...editData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(ICON_MAP).map(iconName => (
                    <SelectItem key={iconName} value={iconName}>
                      {iconName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                checked={editData.enabled}
                onCheckedChange={(checked) => setEditData({ ...editData, enabled: checked })}
              />
              <Label>활성화</Label>
            </div>
          </div>

          {/* 컬럼에서 필드 추가 */}
          {tableColumns.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">테이블 컬럼에서 필드 추가</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSelectedColumns}
                  disabled={selectedColumns.length === 0}
                >
                  선택된 컬럼 추가 ({selectedColumns.length})
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {tableColumns.map(column => (
                  <div
                    key={column.columnName}
                    className={`p-2 border rounded cursor-pointer transition-colors ${
                      selectedColumns.includes(column) ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      if (selectedColumns.includes(column)) {
                        setSelectedColumns(selectedColumns.filter(c => c !== column));
                      } else {
                        setSelectedColumns([...selectedColumns, column]);
                      }
                    }}
                  >
                    <div className="font-medium text-sm">{column.columnName}</div>
                    <div className="text-xs text-muted-foreground">{column.dataType}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 필드 관리 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">필드 설정</h4>
              <Button variant="outline" size="sm" onClick={() => addField()}>
                <Plus className="h-4 w-4 mr-2" />
                필드 추가
              </Button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(editData.fields || {}).map(([fieldName, field]) => (
                <div key={fieldName} className="p-3 border rounded space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{fieldName}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeField(fieldName)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">표시명</Label>
                      <Input
                        value={field.displayName}
                        onChange={(e) => updateField(fieldName, { displayName: e.target.value })}
                        placeholder="표시명"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">타입</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) => updateField(fieldName, { type: value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">설명</Label>
                    <Input
                      value={field.description}
                      onChange={(e) => updateField(fieldName, { description: e.target.value })}
                      placeholder="필드 설명"
                      className="h-8"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={field.filterable}
                      onCheckedChange={(checked) => updateField(fieldName, { filterable: checked })}
                    />
                    <Label className="text-xs">필터 가능</Label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  저장
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 