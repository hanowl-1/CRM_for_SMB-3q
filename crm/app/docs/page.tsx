'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DocsPage() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/docs');
        if (!response.ok) {
          throw new Error('API 스펙을 불러올 수 없습니다.');
        }
        const data = await response.json();
        setSpec(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSpec();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-lg">API 문서를 로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">오류 발생</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold">API 문서</h1>
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            OpenAPI 3.0.3
          </Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                총 엔드포인트
              </CardTitle>
              <div className="text-2xl font-bold">
                {spec ? Object.keys(spec.paths || {}).length : 0}개
              </div>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                API 버전
              </CardTitle>
              <div className="text-2xl font-bold">
                {spec?.info?.version || 'N/A'}
              </div>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                카테고리
              </CardTitle>
              <div className="text-2xl font-bold">
                {spec ? (spec.tags || []).length : 0}개
              </div>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">
                  마케팅 자동화 CRM 시스템 API
                </h3>
                <p className="text-sm text-blue-700">
                  Next.js 15 App Router 기반으로 구축된 CRM 시스템의 RESTful API입니다. 
                  워크플로우 관리, 메시징, 데이터베이스 연동, 스케줄링 등의 기능을 제공합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Swagger UI */}
      <div className="swagger-container">
        <style jsx global>{`
          .swagger-container .swagger-ui {
            font-family: inherit;
          }
          .swagger-container .swagger-ui .info {
            margin: 0;
          }
          .swagger-container .swagger-ui .scheme-container {
            background: #fafafa;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .swagger-container .swagger-ui .info .title {
            color: #1f2937;
          }
          .swagger-container .swagger-ui .info .description {
            color: #6b7280;
          }
          .swagger-container .swagger-ui .opblock.opblock-get {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.1);
          }
          .swagger-container .swagger-ui .opblock.opblock-post {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
          }
          .swagger-container .swagger-ui .opblock.opblock-put {
            border-color: #f59e0b;
            background: rgba(245, 158, 11, 0.1);
          }
          .swagger-container .swagger-ui .opblock.opblock-delete {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
          }
        `}</style>
        
        {spec && (
          <SwaggerUI 
            spec={spec}
            docExpansion="list"
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={2}
            displayOperationId={false}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        )}
      </div>
    </div>
  );
} 