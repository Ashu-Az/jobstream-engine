'use client';

import { Database, Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onTriggerImport: () => void;
  importing: boolean;
}

export default function Header({ onTriggerImport, importing }: HeaderProps) {
  return (
    <div className="border-b bg-card">
      <div className="flex h-16 items-center px-8">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Database className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Job Importer</h1>
            <p className="text-xs text-muted-foreground">
              Real-time job import monitoring
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          <Button
            onClick={onTriggerImport}
            disabled={importing}
            className="font-medium"
          >
            {importing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Trigger Bulk Import
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
