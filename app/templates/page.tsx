import { TemplateBrowser } from '@/components/templates/template-browser';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function TemplatesPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">템플릿 관리</h1>
        <Link href="/templates/sync">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            CoolSMS 템플릿 동기화
          </Button>
        </Link>
      </div>
      <TemplateBrowser />
    </div>
  );
} 