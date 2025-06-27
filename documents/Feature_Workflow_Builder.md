# 워크플로우 빌더 기능 명세서 v2.0
## 3단계 최적화 워크플로우 시스템

### 1. 개요

#### 1.1 기능 목적
**3단계 워크플로우 프로세스**에 최적화된 직관적이고 효율적인 워크플로우 빌더를 제공합니다.

**핵심 3단계 프로세스:**
1. **알림톡 선택**: 템플릿 변수 동적 쿼리 설정
2. **대상 선정**: MySQL 동적 쿼리로 상황별 대상자 추출  
3. **대상-템플릿 매핑**: 개인화 메시지를 위한 변수-컬럼 매핑

#### 1.2 주요 특징
- **단계별 UI**: 각 단계에 특화된 사용자 인터페이스
- **실시간 미리보기**: 각 단계별 결과 즉시 확인
- **매핑 재사용**: 설정한 매핑 템플릿 저장 및 재사용
- **오류 방지**: 단계별 유효성 검사 및 가이드
- **성능 최적화**: 대용량 데이터 처리 최적화

### 2. 1단계: 알림톡 선택

#### 2.1 📱 알림톡 템플릿 선택 기능

##### 2.1.1 템플릿 브라우저
```typescript
interface TemplateSelector {
  // 템플릿 목록 표시
  templates: KakaoTemplate[];
  
  // 필터링 옵션
  filters: {
    category: 'welcome' | 'reminder' | 'promotion' | 'performance' | 'others';
    status: 'active' | 'draft' | 'archived';
    searchText: string;
  };
  
  // 선택된 템플릿
  selectedTemplate: KakaoTemplate | null;
  
  // 템플릿 미리보기
  preview: {
    content: string;
    variables: string[];
    buttons: TemplateButton[];
  };
}
```

**UI 구성:**
- **템플릿 카드 그리드**: 카테고리별 색상 구분
- **실시간 검색**: 템플릿명, 내용 검색
- **미리보기 패널**: 선택 즉시 우측에 미리보기 표시
- **변수 하이라이트**: 템플릿 내 변수 자동 강조 표시

##### 2.1.2 변수 쿼리 설정
```typescript
interface VariableQueryConfig {
  templateId: string;
  variables: {
    [variableName: string]: {
      sourceType: 'field' | 'query' | 'static';
      
      // 필드 매핑 (sourceType: 'field')
      field?: string;
      
      // 동적 쿼리 (sourceType: 'query')  
      sql?: string;
      description?: string;
      defaultValue: string;
      formatter: 'text' | 'number' | 'currency' | 'date';
      
      // 정적 값 (sourceType: 'static')
      staticValue?: string;
    };
  };
}
```

**변수 쿼리 에디터:**
- **SQL 에디터**: 문법 하이라이트, 자동완성
- **쿼리 테스트**: 실시간 쿼리 결과 확인
- **변수 미리보기**: 실제 데이터로 변수 치환 결과 확인
- **기본값 설정**: 쿼리 실패 시 사용할 기본값

#### 2.2 🔧 변수 관리 시스템

##### 2.2.1 자동 변수 추출
```typescript
class VariableExtractor {
  extractVariables(templateContent: string): ExtractedVariable[] {
    // {{변수명}} 패턴 추출
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: ExtractedVariable[] = [];
    
    let match;
    while ((match = regex.exec(templateContent)) !== null) {
      const variableName = match[1].trim();
      
      variables.push({
        name: variableName,
        position: match.index,
        length: match[0].length,
        type: this.inferVariableType(variableName), // 'name', 'count', 'date', 'amount' 등
        suggestions: this.getSuggestions(variableName)
      });
    }
    
    return variables;
  }
  
  private inferVariableType(variableName: string): VariableType {
    // 변수명 패턴으로 타입 추론
    if (variableName.includes('이름') || variableName.includes('name')) return 'name';
    if (variableName.includes('수') || variableName.includes('count')) return 'count';
    if (variableName.includes('날짜') || variableName.includes('date')) return 'date';
    if (variableName.includes('금액') || variableName.includes('amount')) return 'amount';
    return 'text';
  }
}
```

##### 2.2.2 변수 쿼리 템플릿 관리
```typescript
interface VariableQueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  // 재사용 가능한 쿼리 설정
  queryConfig: {
    sql: string;
    parameters: string[];
    expectedColumns: string[];
    description: string;
  };
  
  // 사용 통계
  usageCount: number;
  lastUsedAt: Date;
  isPublic: boolean;
  isFavorite: boolean;
}
```

**기능:**
- **쿼리 템플릿 라이브러리**: 자주 사용하는 쿼리 저장
- **카테고리 관리**: 리뷰 관련, 고객 정보, 매출 등
- **즐겨찾기**: 자주 사용하는 템플릿 빠른 접근
- **공유 기능**: 팀 내 쿼리 템플릿 공유

### 3. 2단계: 대상 선정

#### 3.1 🎯 동적 쿼리 빌더

##### 3.1.1 쿼리 에디터
```typescript
interface QueryBuilder {
  // SQL 에디터 설정
  editor: {
    content: string;
    language: 'mysql';
    theme: 'vs-dark';
    options: {
      autoIndent: true;
      formatOnType: true;
      suggestOnTriggerCharacters: true;
    };
  };
  
  // 스키마 정보
  schema: {
    tables: MySQLTable[];
    currentTable?: string;
    columns: MySQLColumn[];
  };
  
  // 쿼리 실행 결과
  result: {
    data: any[];
    columns: string[];
    rowCount: number;
    executionTime: number;
    error?: string;
  };
}
```

**SQL 에디터 기능:**
- **문법 하이라이트**: MySQL 문법 강조
- **자동완성**: 테이블명, 컬럼명 자동완성
- **실시간 검증**: 문법 오류 실시간 표시
- **포맷팅**: 자동 코드 정리

##### 3.1.2 스키마 브라우저
```typescript
interface SchemaBrowser {
  tables: {
    name: string;
    comment?: string;
    rowCount: number;
    columns: {
      name: string;
      type: string;
      nullable: boolean;
      comment?: string;
      isPrimaryKey: boolean;
      isForeignKey: boolean;
    }[];
  }[];
  
  // 테이블 관계 정보
  relationships: {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  }[];
}
```

**기능:**
- **테이블 트리뷰**: 계층적 스키마 표시
- **컬럼 정보**: 타입, 제약조건, 설명 표시
- **관계 시각화**: 테이블 간 관계 다이어그램
- **샘플 데이터**: 각 컬럼의 샘플 값 표시

#### 3.2 🔍 대상자 미리보기

##### 3.2.1 실시간 쿼리 실행
```typescript
class QueryPreview {
  async executePreview(sql: string, limit: number = 10): Promise<PreviewResult> {
    try {
      // 안전한 쿼리 실행 (SELECT만 허용)
      const sanitizedSQL = this.sanitizeQuery(sql, limit);
      const result = await this.mysqlClient.query(sanitizedSQL);
      
      return {
        success: true,
        data: result.rows,
        columns: result.fields.map(f => ({
          name: f.name,
          type: f.type,
          displayName: this.getDisplayName(f.name)
        })),
        totalRows: result.rowCount,
        executionTime: result.executionTime,
        query: sanitizedSQL
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: this.getSuggestion(error)
      };
    }
  }
  
  private sanitizeQuery(sql: string, limit: number): string {
    // SELECT 문만 허용
    if (!sql.trim().toLowerCase().startsWith('select')) {
      throw new Error('SELECT 문만 실행 가능합니다.');
    }
    
    // LIMIT 자동 추가
    if (!sql.toLowerCase().includes('limit')) {
      sql += ` LIMIT ${limit}`;
    }
    
    return sql;
  }
}
```

##### 3.2.2 결과 데이터 표시
```typescript
interface PreviewTable {
  columns: {
    key: string;
    title: string;
    dataType: 'string' | 'number' | 'date' | 'boolean';
    width?: number;
    fixed?: 'left' | 'right';
  }[];
  
  data: Record<string, any>[];
  
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger: boolean;
  };
  
  // 컬럼 통계
  statistics: {
    [columnName: string]: {
      uniqueCount: number;
      nullCount: number;
      sampleValues: any[];
    };
  };
}
```

**기능:**
- **데이터 테이블**: 페이지네이션, 정렬, 필터링
- **컬럼 통계**: 고유값 수, NULL 수, 샘플 값
- **데이터 타입 자동 인식**: 전화번호, 이메일 등 특수 형식 감지
- **내보내기**: CSV, Excel 형태로 결과 다운로드

#### 3.3 📚 쿼리 템플릿 라이브러리

##### 3.3.1 사전 정의 쿼리
```typescript
const PREDEFINED_QUERIES = {
  customer_segments: {
    active_customers: {
      name: "활성 고객",
      description: "최근 30일 내 활동한 고객",
      sql: `
        SELECT id, contacts, company_name, last_login_date
        FROM customers 
        WHERE last_login_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND status = 'active'
        ORDER BY last_login_date DESC
      `,
      category: "고객 분류"
    },
    
    high_review_customers: {
      name: "리뷰 많은 고객",
      description: "리뷰 10개 이상 보유 고객",
      sql: `
        SELECT c.id, c.contacts, c.company_name, COUNT(r.id) as review_count
        FROM customers c
        JOIN reviews r ON c.id = r.company_id
        GROUP BY c.id, c.contacts, c.company_name
        HAVING COUNT(r.id) >= 10
        ORDER BY review_count DESC
      `,
      category: "성과 기반"
    }
  }
};
```

##### 3.3.2 커스텀 쿼리 저장
```typescript
interface SavedQuery {
  id: string;
  name: string;
  description: string;
  sql: string;
  category: string;
  tags: string[];
  
  // 메타데이터
  createdBy: string;
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  
  // 공유 설정
  isPublic: boolean;
  isFavorite: boolean;
  
  // 쿼리 정보
  expectedColumns: string[];
  estimatedRowCount?: number;
}
```

### 4. 3단계: 대상-템플릿 매핑

#### 4.1 🔗 개인화 변수 매칭 시스템 (핵심)

##### 4.1.1 매칭 프로세스 개요

**🚨 핵심: 메모리에서 데이터 매칭**

**❌ 잘못된 방식: 쿼리로 매칭 시도**
```sql
-- 쿼리에서 직접 조인하거나 WHERE 조건으로 매칭하는 방식
SELECT r.review_count 
FROM reviews r 
JOIN ads a ON r.customer_id = a.id 
WHERE a.id = 7341;
```

**✅ 올바른 방식: 메모리에서 데이터 매칭**

> **핵심 개념**: 각각의 쿼리를 별도로 실행한 후, **애플리케이션 메모리에서 데이터를 매칭**하는 것이 핵심입니다. 이는 유연성과 성능을 동시에 확보할 수 있는 범용적 매칭 시스템입니다.

**1단계: 알림톡 변수 쿼리 실행** (전체 데이터 조회하여 메모리에 캐시)
```sql
-- 전체 리뷰 데이터를 메모리로 로드
SELECT customer_id, COUNT(*) as review_count 
FROM reviews 
GROUP BY customer_id;
-- 결과: [{customer_id: 7341, review_count: 25}, {customer_id: 7342, review_count: 30}, ...]
```

**2단계: 대상자 쿼리 실행** (대상자 데이터 조회)  
```sql
-- 대상자 정보 조회
SELECT contacts, id, company_name 
FROM ads 
WHERE id IN (7341, 7342, 7343);
-- 결과: [{id: 7341, contacts: "010-1234-5678", company_name: "회사A"}, ...]
```

**3단계: 메모리에서 매칭 수행** ⭐ **이게 핵심!**
```typescript
// 🔥 메모리에서 데이터 매칭 (쿼리 아님!)
for (const targetContact of targetContacts) {
  // BB열(대상자의 매칭 컬럼): targetContact.id = 7341
  const targetMappingValue = targetContact.id;
  
  // AA열(변수 데이터의 매칭 컬럼)과 BB열 값이 같은 행 찾기
  const matchedRow = variableData.find(row => 
    row.customer_id === targetMappingValue  // AA열과 BB열 메모리 매칭
  );
  
  // AB열(변수 데이터의 출력 컬럼) 값을 개인화 변수로 사용
  const personalizedValue = matchedRow ? matchedRow.review_count : '0';
  
  console.log(`✅ 메모리 매칭 성공: ${targetContact.company_name} → ${personalizedValue}개`);
}
```

**매칭 구조 설명:**
- **AA열**: 알림톡 변수 쿼리의 **매칭 컬럼** (예: `customer_id`)
- **AB열**: 알림톡 변수 쿼리의 **출력 컬럼** (예: `review_count`) 
- **BA열**: 대상자 쿼리의 **연락처 컬럼** (예: `contacts`)
- **BB열**: 대상자 쿼리의 **매칭 컬럼** (예: `id`)

**매칭 원리**: `AA열 값 == BB열 값`인 행을 메모리에서 찾아서 `AB열` 값을 개인화 변수로 사용

##### 4.1.2 매칭 설정 구조

```typescript
interface PersonalizationMappingConfig {
  // 알림톡 변수 설정
  templateVariable: {
    name: string;           // 예: "#{total_reviews}"
    sourceQuery: string;    // 전체 데이터 조회 쿼리
    mappingColumn: string;  // AA열: 매칭에 사용할 컬럼 (예: "customer_id")
    outputColumn: string;   // AB열: 출력할 값의 컬럼 (예: "review_count")
  };
  
  // 대상자 설정  
  targetData: {
    sourceQuery: string;    // 대상자 조회 쿼리
    contactColumn: string;  // BA열: 연락처 컬럼 (예: "contacts")
    mappingColumn: string;  // BB열: 매칭에 사용할 컬럼 (예: "id")
  };
  
  // 매칭 규칙
  matchingRule: {
    templateMappingColumn: string;  // AA열 (예: "customer_id")
    targetMappingColumn: string;    // BB열 (예: "id")
    matchType: 'exact' | 'contains' | 'regex';
    defaultValue: string;           // 매칭 실패 시 기본값
  };
}
```

##### 4.1.3 매칭 실행 엔진

```typescript
class PersonalizationMatchingEngine {
  async executePersonalization(
    config: PersonalizationMappingConfig,
    targetContacts: any[]
  ): Promise<PersonalizationResult[]> {
    
    // 1. 알림톡 변수 쿼리 실행 (전체 데이터)
    const variableData = await this.executeQuery(config.templateVariable.sourceQuery);
    console.log(`🔍 변수 데이터 조회 완료: ${variableData.length}개 행`);
    
    // 2. 각 대상자별 개인화 수행
    const results: PersonalizationResult[] = [];
    
    for (const contact of targetContacts) {
      // 3. 매칭 키 값 추출
      const targetMappingValue = contact[config.matchingRule.targetMappingColumn];
      
      // 4. 변수 데이터에서 매칭되는 행 찾기
      const matchedRow = variableData.find(row => 
        this.isMatch(
          row[config.matchingRule.templateMappingColumn],
          targetMappingValue,
          config.matchingRule.matchType
        )
      );
      
      // 5. 개인화 값 결정
      const personalizedValue = matchedRow 
        ? String(matchedRow[config.templateVariable.outputColumn])
        : config.matchingRule.defaultValue;
      
      results.push({
        contact: contact,
        variableName: config.templateVariable.name,
        personalizedValue: personalizedValue,
        matchFound: !!matchedRow,
        matchingKey: targetMappingValue
      });
      
      console.log(`✅ 매칭 완료: ${contact[config.targetData.contactColumn]} → ${personalizedValue}`);
    }
    
    return results;
  }
  
  private isMatch(templateValue: any, targetValue: any, matchType: string): boolean {
    switch (matchType) {
      case 'exact':
        return String(templateValue) === String(targetValue);
      case 'contains':
        return String(templateValue).includes(String(targetValue));
      case 'regex':
        return new RegExp(String(templateValue)).test(String(targetValue));
      default:
        return false;
    }
  }
}
```

##### 4.1.4 매칭 시각화 UI

```typescript
interface MappingVisualization {
  // 매핑 관계 표시
  mappingFlow: {
    // 알림톡 변수 쪽
    templateSide: {
      queryPreview: string;
      sampleData: any[];
      mappingColumn: string;  // AA열
      outputColumn: string;   // AB열
    };
    
    // 대상자 쪽  
    targetSide: {
      queryPreview: string;
      sampleData: any[];
      contactColumn: string;  // BA열
      mappingColumn: string;  // BB열
    };
    
    // 매칭 결과
    matchingResult: {
      matchedCount: number;
      unmatchedCount: number;
      sampleMatches: MatchingSample[];
    };
  };
}

interface MatchingSample {
  targetContact: string;           // 대상자 연락처
  targetMappingValue: any;         // BB열 값
  templateMappingValue: any;       // AA열 값 (매칭된)
  personalizedValue: any;          // AB열 값 (최종 개인화 값)
  matchStatus: 'matched' | 'unmatched';
}
```

**UI 구성:**
- **3열 레이아웃**: 알림톡 변수 | 매칭 흐름 | 대상자 데이터
- **매칭 흐름 시각화**: AA열 ↔ BB열 연결선 표시
- **실시간 미리보기**: 매칭 결과 즉시 확인
- **매칭 통계**: 성공/실패 개수, 매칭률 표시

##### 4.1.5 매칭 최적화 전략

```typescript
class MappingOptimizer {
  // 대용량 데이터 매칭 최적화
  async optimizedMatching(
    variableData: any[],
    targetContacts: any[],
    mappingConfig: MappingConfig
  ): Promise<PersonalizationResult[]> {
    
    // 1. 변수 데이터를 Map으로 인덱싱 (O(1) 조회)
    const variableMap = new Map();
    variableData.forEach(row => {
      const key = row[mappingConfig.templateMappingColumn];
      variableMap.set(String(key), row);
    });
    
    // 2. 대상자별 빠른 매칭
    const results = targetContacts.map(contact => {
      const targetKey = String(contact[mappingConfig.targetMappingColumn]);
      const matchedRow = variableMap.get(targetKey);
      
      return {
        contact,
        personalizedValue: matchedRow 
          ? String(matchedRow[mappingConfig.outputColumn])
          : mappingConfig.defaultValue,
        matchFound: !!matchedRow
      };
    });
    
    return results;
  }
  
  // 매칭 성능 분석
  analyzeMatchingPerformance(results: PersonalizationResult[]): MatchingAnalysis {
    const totalCount = results.length;
    const matchedCount = results.filter(r => r.matchFound).length;
    const unmatchedCount = totalCount - matchedCount;
    
    return {
      totalTargets: totalCount,
      matchedTargets: matchedCount,
      unmatchedTargets: unmatchedCount,
      matchingRate: (matchedCount / totalCount) * 100,
      recommendations: this.generateRecommendations(results)
    };
  }
}
```

##### 4.1.6 매칭 디버깅 도구

```typescript
interface MappingDebugger {
  // 매칭 실패 원인 분석
  analyzeMatchingFailures(
    unmatchedContacts: any[],
    variableData: any[],
    mappingConfig: MappingConfig
  ): DebuggingReport {
    
    const issues: DebuggingIssue[] = [];
    
    unmatchedContacts.forEach(contact => {
      const targetValue = contact[mappingConfig.targetMappingColumn];
      
      // 유사한 값 찾기
      const similarValues = variableData
        .map(row => ({
          value: row[mappingConfig.templateMappingColumn],
          similarity: this.calculateSimilarity(targetValue, row[mappingConfig.templateMappingColumn])
        }))
        .filter(item => item.similarity > 0.7)
        .sort((a, b) => b.similarity - a.similarity);
      
      issues.push({
        contact: contact[mappingConfig.contactColumn],
        targetValue: targetValue,
        issue: similarValues.length > 0 ? 'similar_values_found' : 'no_matching_data',
        suggestions: similarValues.slice(0, 3),
        recommendation: this.generateRecommendation(targetValue, similarValues)
      });
    });
    
    return {
      totalIssues: issues.length,
      issuesByType: this.groupIssuesByType(issues),
      detailedIssues: issues,
      overallRecommendations: this.generateOverallRecommendations(issues)
    };
  }
}
```

이 매칭 시스템의 핵심 장점:
- **범용성**: 모든 종류의 쿼리와 데이터에 적용 가능
- **성능**: 인덱싱을 통한 빠른 매칭
- **유연성**: 다양한 매칭 규칙 지원
- **디버깅**: 매칭 실패 원인 분석 및 해결 방안 제시
- **확장성**: 대용량 데이터 처리 최적화

#### 4.2 📋 매핑 템플릿 관리

##### 4.2.1 매핑 템플릿 저장
```typescript
interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  
  // 매핑 설정
  mappings: {
    templateVariable: string;
    targetColumn: string;
    formatter: string;
    defaultValue?: string;
  }[];
  
  // 적용 조건
  applicableTemplates: string[]; // 적용 가능한 템플릿 ID
  expectedColumns: string[];     // 필요한 컬럼 목록
  
  // 메타데이터
  usageCount: number;
  lastUsedAt?: Date;
  isPublic: boolean;
  isFavorite: boolean;
  createdBy: string;
  createdAt: Date;
}
```

##### 4.2.2 매핑 템플릿 추천
```typescript
class MappingRecommendationEngine {
  recommendMappings(
    templateVariables: TemplateVariable[],
    targetColumns: TargetColumn[]
  ): MappingRecommendation[] {
    const recommendations: MappingRecommendation[] = [];
    
    for (const variable of templateVariables) {
      // 1. 정확한 이름 매칭
      const exactMatch = targetColumns.find(col => 
        col.name.toLowerCase() === variable.name.toLowerCase()
      );
      
      if (exactMatch) {
        recommendations.push({
          variable: variable.name,
          column: exactMatch.name,
          confidence: 0.95,
          reason: 'exact_name_match'
        });
        continue;
      }
      
      // 2. 유사한 이름 매칭
      const similarMatches = targetColumns
        .map(col => ({
          column: col,
          similarity: this.calculateSimilarity(variable.name, col.name)
        }))
        .filter(match => match.similarity > 0.7)
        .sort((a, b) => b.similarity - a.similarity);
      
      if (similarMatches.length > 0) {
        recommendations.push({
          variable: variable.name,
          column: similarMatches[0].column.name,
          confidence: similarMatches[0].similarity,
          reason: 'similar_name_match'
        });
        continue;
      }
      
      // 3. 데이터 타입 기반 매칭
      const typeMatches = this.findByDataType(variable, targetColumns);
      if (typeMatches.length > 0) {
        recommendations.push({
          variable: variable.name,
          column: typeMatches[0].name,
          confidence: 0.5,
          reason: 'data_type_match'
        });
      }
    }
    
    return recommendations;
  }
}
```

### 5. 통합 워크플로우 관리

#### 5.1 🔄 워크플로우 실행 엔진

##### 5.1.1 실행 파이프라인
```typescript
class WorkflowExecutionPipeline {
  async execute(workflowId: string): Promise<ExecutionResult> {
    const workflow = await this.loadWorkflow(workflowId);
    const executionId = this.generateExecutionId();
    
    try {
      // 실행 로그 시작
      await this.logExecutionStart(executionId, workflow);
      
      // 1단계: 템플릿 처리
      const step1Result = await this.executeStep1(workflow);
      await this.logStepResult(executionId, 1, step1Result);
      
      // 2단계: 대상 선정
      const step2Result = await this.executeStep2(workflow);
      await this.logStepResult(executionId, 2, step2Result);
      
      // 3단계: 매핑 및 메시지 생성
      const step3Result = await this.executeStep3(workflow, step1Result, step2Result);
      await this.logStepResult(executionId, 3, step3Result);
      
      // 4단계: 메시지 발송
      const sendResult = await this.sendMessages(step3Result.messages);
      await this.logStepResult(executionId, 4, sendResult);
      
      // 실행 완료
      const finalResult = {
        executionId,
        success: true,
        totalMessages: step3Result.messages.length,
        sentCount: sendResult.sentCount,
        failedCount: sendResult.failedCount,
        executionTime: Date.now() - step1Result.startTime
      };
      
      await this.logExecutionComplete(executionId, finalResult);
      return finalResult;
      
    } catch (error) {
      await this.logExecutionError(executionId, error);
      throw error;
    }
  }
  
  private async executeStep1(workflow: Workflow): Promise<Step1Result> {
    // 템플릿 로드 및 변수 쿼리 준비
    const templates = await this.loadTemplates(workflow.message_config.templates);
    
    return {
      templates,
      variableQueries: this.prepareVariableQueries(templates),
      startTime: Date.now()
    };
  }
  
  private async executeStep2(workflow: Workflow): Promise<Step2Result> {
    // 대상 쿼리 실행
    const targetGroups = workflow.target_config.targetGroups;
    const allTargets = [];
    
    for (const group of targetGroups) {
      if (group.type === 'dynamic') {
        const targets = await this.mysqlService.executeQuery(group.dynamicQuery.sql);
        allTargets.push(...targets);
      }
    }
    
    return {
      targets: allTargets,
      targetCount: allTargets.length
    };
  }
  
  private async executeStep3(
    workflow: Workflow,
    step1: Step1Result,
    step2: Step2Result
  ): Promise<Step3Result> {
    // 매핑 적용 및 메시지 생성
    const mappings = workflow.mapping_config.targetTemplateMappings;
    const messages = [];
    
    for (const mapping of mappings) {
      const template = step1.templates.find(t => t.id === mapping.templateId);
      
      for (const target of step2.targets) {
        const resolvedVariables = await this.resolveVariables(
          mapping.fieldMappings,
          target,
          step1.variableQueries
        );
        
        const finalMessage = this.renderTemplate(template.content, resolvedVariables);
        
        messages.push({
          target,
          template,
          message: finalMessage,
          variables: resolvedVariables
        });
      }
    }
    
    return { messages };
  }
}
```

#### 5.2 📊 실행 모니터링

##### 5.2.1 실시간 진행 상황
```typescript
interface ExecutionMonitor {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  
  steps: {
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    progress?: number; // 0-100
    result?: any;
    error?: string;
  }[];
  
  // 전체 진행률
  overallProgress: number;
  
  // 성과 지표
  metrics: {
    totalTargets: number;
    processedTargets: number;
    generatedMessages: number;
    sentMessages: number;
    failedMessages: number;
  };
  
  // 실행 시간
  startTime: Date;
  estimatedEndTime?: Date;
  actualEndTime?: Date;
}
```

##### 5.2.2 오류 처리 및 재시도
```typescript
class ErrorHandler {
  async handleStepError(
    step: number,
    error: Error,
    context: ExecutionContext
  ): Promise<ErrorHandlingResult> {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'mysql_connection_error':
        // MySQL 연결 오류 - 재시도
        if (context.retryCount < 3) {
          await this.delay(1000 * Math.pow(2, context.retryCount)); // 지수 백오프
          return { action: 'retry', delay: 0 };
        }
        return { action: 'fail', message: 'MySQL 연결 실패' };
        
      case 'template_variable_error':
        // 변수 해결 실패 - 기본값 사용
        return { 
          action: 'continue', 
          fallback: 'use_default_values',
          message: '일부 변수를 기본값으로 대체했습니다.'
        };
        
      case 'message_send_error':
        // 메시지 발송 실패 - 개별 처리
        return { 
          action: 'continue',
          message: '일부 메시지 발송에 실패했습니다.'
        };
        
      default:
        return { action: 'fail', message: error.message };
    }
  }
}
```

### 6. 사용자 경험 최적화

#### 6.1 🎨 UI/UX 개선사항

##### 6.1.1 단계별 진행 표시
```typescript
interface StepProgress {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
  
  stepInfo: {
    [step: number]: {
      title: string;
      description: string;
      status: 'pending' | 'current' | 'completed' | 'error';
      validationStatus: 'valid' | 'invalid' | 'warning';
      canProceed: boolean;
    };
  };
}
```

**기능:**
- **진행 표시바**: 현재 단계와 완료 상태 표시
- **단계별 검증**: 각 단계 완료 전 유효성 검사
- **되돌아가기**: 이전 단계로 자유롭게 이동
- **자동 저장**: 단계별 설정 자동 저장

##### 6.1.2 실시간 도움말
```typescript
interface ContextualHelp {
  // 현재 컨텍스트 기반 도움말
  currentContext: {
    step: number;
    component: string;
    userAction: string;
  };
  
  // 도움말 컨텐츠
  helpContent: {
    title: string;
    description: string;
    examples?: string[];
    commonIssues?: {
      issue: string;
      solution: string;
    }[];
    relatedLinks?: {
      text: string;
      url: string;
    }[];
  };
  
  // 튜토리얼 모드
  tutorialMode: {
    enabled: boolean;
    currentStep: number;
    totalSteps: number;
    highlights: string[]; // CSS 셀렉터
  };
}
```

#### 6.2 ⚡ 성능 최적화

##### 6.2.1 지연 로딩
```typescript
class LazyLoadingManager {
  // 템플릿 목록 가상화
  async loadTemplatesVirtualized(
    offset: number,
    limit: number,
    filters: TemplateFilters
  ): Promise<VirtualizedResult<KakaoTemplate>> {
    const result = await this.templateService.getTemplates({
      offset,
      limit,
      ...filters
    });
    
    return {
      items: result.templates,
      totalCount: result.totalCount,
      hasMore: offset + limit < result.totalCount,
      nextOffset: offset + limit
    };
  }
  
  // 쿼리 결과 페이지네이션
  async loadQueryResultsPaginated(
    sql: string,
    page: number,
    pageSize: number
  ): Promise<PaginatedQueryResult> {
    const offset = (page - 1) * pageSize;
    const limitedSQL = `${sql} LIMIT ${pageSize} OFFSET ${offset}`;
    
    const [dataResult, countResult] = await Promise.all([
      this.mysqlService.executeQuery(limitedSQL),
      this.mysqlService.executeQuery(`SELECT COUNT(*) as total FROM (${sql}) as subquery`)
    ]);
    
    return {
      data: dataResult,
      totalCount: countResult[0].total,
      currentPage: page,
      pageSize,
      totalPages: Math.ceil(countResult[0].total / pageSize)
    };
  }
}
```

##### 6.2.2 캐싱 전략
```typescript
class WorkflowCache {
  private cache = new Map<string, CacheEntry>();
  
  // 스키마 정보 캐싱 (24시간)
  async getSchemaInfo(force: boolean = false): Promise<SchemaInfo> {
    const cacheKey = 'mysql_schema';
    const cached = this.cache.get(cacheKey);
    
    if (!force && cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.data;
    }
    
    const schema = await this.mysqlService.getSchemaInfo();
    this.cache.set(cacheKey, {
      data: schema,
      timestamp: Date.now()
    });
    
    return schema;
  }
  
  // 쿼리 결과 캐싱 (5분)
  async getCachedQueryResult(sql: string): Promise<any[] | null> {
    const cacheKey = `query_${this.hashSQL(sql)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
    
    return null;
  }
  
  async setCachedQueryResult(sql: string, result: any[]): Promise<void> {
    const cacheKey = `query_${this.hashSQL(sql)}`;
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
  }
}
```

### 7. 고급 기능

#### 7.1 🤖 AI 기반 기능

##### 7.1.1 자동 매핑 제안
```typescript
class AIMapping {
  async suggestMappings(
    templateVariables: TemplateVariable[],
    targetColumns: TargetColumn[],
    historicalMappings: MappingHistory[]
  ): Promise<MappingSuggestion[]> {
    const suggestions: MappingSuggestion[] = [];
    
    for (const variable of templateVariables) {
      // 1. 과거 매핑 이력 분석
      const historicalMatch = this.findHistoricalMapping(variable, historicalMappings);
      if (historicalMatch) {
        suggestions.push({
          variable: variable.name,
          column: historicalMatch.column,
          confidence: 0.9,
          reason: 'historical_usage',
          evidence: `과거 ${historicalMatch.usageCount}회 사용됨`
        });
        continue;
      }
      
      // 2. 의미적 유사성 분석
      const semanticMatches = await this.findSemanticMatches(variable, targetColumns);
      if (semanticMatches.length > 0) {
        suggestions.push({
          variable: variable.name,
          column: semanticMatches[0].column,
          confidence: semanticMatches[0].confidence,
          reason: 'semantic_similarity',
          evidence: semanticMatches[0].explanation
        });
        continue;
      }
      
      // 3. 패턴 기반 매칭
      const patternMatch = this.findPatternMatch(variable, targetColumns);
      if (patternMatch) {
        suggestions.push({
          variable: variable.name,
          column: patternMatch.column,
          confidence: 0.7,
          reason: 'pattern_match',
          evidence: patternMatch.pattern
        });
      }
    }
    
    return suggestions;
  }
}
```

##### 7.1.2 쿼리 최적화 제안
```typescript
class QueryOptimizer {
  async analyzeQuery(sql: string): Promise<QueryAnalysis> {
    const analysis = await this.parseSQL(sql);
    const suggestions: OptimizationSuggestion[] = [];
    
    // 인덱스 사용 분석
    if (analysis.whereClause && !analysis.usesIndex) {
      suggestions.push({
        type: 'index_suggestion',
        severity: 'warning',
        message: 'WHERE 절에 인덱스가 없는 컬럼이 사용되었습니다.',
        suggestion: `${analysis.whereColumns.join(', ')} 컬럼에 인덱스 추가를 고려하세요.`,
        impact: 'performance'
      });
    }
    
    // LIMIT 절 누락
    if (!analysis.hasLimit && analysis.estimatedRowCount > 1000) {
      suggestions.push({
        type: 'limit_suggestion',
        severity: 'error',
        message: '대용량 데이터 조회 시 LIMIT 절이 필요합니다.',
        suggestion: 'LIMIT 절을 추가하여 결과를 제한하세요.',
        impact: 'performance'
      });
    }
    
    // 비효율적인 JOIN
    if (analysis.joins.length > 3) {
      suggestions.push({
        type: 'join_optimization',
        severity: 'warning',
        message: '복잡한 JOIN이 감지되었습니다.',
        suggestion: '쿼리를 분할하거나 인덱스를 최적화하세요.',
        impact: 'performance'
      });
    }
    
    return {
      query: sql,
      estimatedExecutionTime: analysis.estimatedTime,
      estimatedRowCount: analysis.estimatedRowCount,
      suggestions,
      complexity: this.calculateComplexity(analysis)
    };
  }
}
```

#### 7.2 📈 분석 및 통계

##### 7.2.1 워크플로우 성과 분석
```typescript
interface WorkflowAnalytics {
  // 실행 통계
  executionStats: {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    averageTargetCount: number;
    averageMessageCount: number;
  };
  
  // 단계별 성과
  stepPerformance: {
    [step: number]: {
      averageTime: number;
      errorRate: number;
      commonErrors: string[];
    };
  };
  
  // 메시지 발송 성과
  messageStats: {
    totalSent: number;
    deliveryRate: number;
    failureReasons: {
      reason: string;
      count: number;
      percentage: number;
    }[];
  };
  
  // 시간별 트렌드
  trends: {
    daily: ExecutionTrend[];
    hourly: ExecutionTrend[];
  };
}
```

##### 7.2.2 사용 패턴 분석
```typescript
class UsageAnalytics {
  async analyzeUsagePatterns(workflowId: string): Promise<UsagePattern> {
    const executions = await this.getExecutionHistory(workflowId);
    
    return {
      // 실행 빈도 패턴
      frequency: {
        daily: this.calculateDailyFrequency(executions),
        weekly: this.calculateWeeklyFrequency(executions),
        monthly: this.calculateMonthlyFrequency(executions)
      },
      
      // 대상자 수 패턴
      targetCountPattern: {
        average: this.calculateAverage(executions.map(e => e.targetCount)),
        trend: this.calculateTrend(executions.map(e => e.targetCount)),
        seasonality: this.detectSeasonality(executions)
      },
      
      // 성공률 패턴
      successRatePattern: {
        overall: this.calculateSuccessRate(executions),
        byTimeOfDay: this.calculateSuccessRateByHour(executions),
        byDayOfWeek: this.calculateSuccessRateByDay(executions)
      },
      
      // 최적화 제안
      optimizationSuggestions: this.generateOptimizationSuggestions(executions)
    };
  }
}
```

### 8. 결론

#### 8.1 핵심 가치
1. **직관적 워크플로우**: 3단계 프로세스로 복잡성 단순화
2. **실시간 피드백**: 각 단계별 즉시 결과 확인
3. **재사용성**: 매핑 템플릿과 쿼리 템플릿 저장/재사용
4. **확장성**: AI 기반 기능과 고급 분석 지원
5. **안정성**: 오류 처리와 복구 메커니즘

#### 8.2 기대 효과
- **생산성 향상**: 복잡한 설정을 단순한 3단계로 축약
- **오류 감소**: 단계별 검증과 자동 제안으로 실수 방지  
- **학습 곡선 단축**: 직관적 UI와 컨텍스트 도움말
- **운영 효율성**: 템플릿 재사용과 자동화로 반복 작업 최소화

이 워크플로우 빌더는 사용자가 복잡한 메시지 자동화를 쉽고 빠르게 구축할 수 있도록 설계된 혁신적인 도구입니다. 