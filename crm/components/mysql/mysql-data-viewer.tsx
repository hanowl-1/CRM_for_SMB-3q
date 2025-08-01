'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Database, 
  Search, 
  RefreshCw, 
  Download,
  Users,
  Building,
  FileText,
  CreditCard
} from 'lucide-react';

interface Company {
  id: number;
  email: string;
  name: string;
  charger: string;
  contacts: string;
  createdAt: string;
  last_login: string;
}

interface Statistics {
  totalCompanies: number;
  totalAds: number;
  totalContracts: number;
  totalUsers: number;
  totalInquiries: number;
  dailySignups: Array<{ date: string; count: number }>;
}

export function MySQLDataViewer() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // 통계 데이터 로드
  const loadStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mysql/statistics');
      const result = await response.json();
      
      if (result.success) {
        setStatistics(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('통계 데이터 로드 실패');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 회사 데이터 로드
  const loadCompanies = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/mysql/companies?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setCompanies(result.data);
        setCurrentPage(page);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('회사 데이터 로드 실패');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 검색 실행
  const handleSearch = () => {
    loadCompanies(1, searchTerm);
  };

  // 새로고침
  const handleRefresh = () => {
    loadStatistics();
    loadCompanies(currentPage, searchTerm);
  };

  // 데이터 내보내기
  const handleExport = async () => {
    try {
      const response = await fetch('/api/mysql/export/companies');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `companies_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('내보내기 실패:', err);
    }
  };

  useEffect(() => {
    loadStatistics();
    loadCompanies();
  }, []);

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">데이터베이스 연결 오류</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="w-4 h-4 mr-2" />
              다시 시도
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MySQL 데이터 뷰어</h1>
          <p className="text-muted-foreground">
            SuperMembers 프로덕션 데이터베이스 (읽기 전용)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            내보내기
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">회사</p>
                  <p className="text-2xl font-bold">{statistics.totalCompanies.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">광고</p>
                  <p className="text-2xl font-bold">{statistics.totalAds.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">계약</p>
                  <p className="text-2xl font-bold">{statistics.totalContracts.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">사용자</p>
                  <p className="text-2xl font-bold">{statistics.totalUsers.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Database className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">문의</p>
                  <p className="text-2xl font-bold">{statistics.totalInquiries.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 데이터 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>회사 목록</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="회사명, 이메일, 담당자 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-64"
              />
              <Button onClick={handleSearch} size="sm">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>데이터를 불러오는 중...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>회사명</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>최근 로그인</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.id}</TableCell>
                    <TableCell>{company.name || '-'}</TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>{company.charger || '-'}</TableCell>
                    <TableCell>{company.contacts || '-'}</TableCell>
                    <TableCell>
                      {company.createdAt ? 
                        new Date(company.createdAt).toLocaleDateString('ko-KR') : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {company.last_login ? (
                        <Badge variant="outline">
                          {new Date(company.last_login).toLocaleDateString('ko-KR')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">미접속</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      <div className="flex justify-center gap-2">
        <Button 
          variant="outline" 
          onClick={() => loadCompanies(currentPage - 1, searchTerm)}
          disabled={currentPage <= 1 || loading}
        >
          이전
        </Button>
        <span className="flex items-center px-4">
          페이지 {currentPage}
        </span>
        <Button 
          variant="outline" 
          onClick={() => loadCompanies(currentPage + 1, searchTerm)}
          disabled={loading}
        >
          다음
        </Button>
      </div>
    </div>
  );
} 