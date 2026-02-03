'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { importApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { ImportLog, StatsResponse } from '@/types';
import ImportHistoryTable from '@/components/ImportHistoryTable';
import StatsCards from '@/components/StatsCards';
import Pagination from '@/components/Pagination';
import Header from '@/components/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function Home() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pageRef = useRef(1);

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      const response = await importApi.getHistory({ page, limit: 20 });
      setLogs(response.data);
      setPagination(response.pagination);
      pageRef.current = page;
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await importApi.getStats();
      setStats(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      return null;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const data = await fetchStats();
    await fetchHistory(pageRef.current);

    const waiting = data?.queue?.waiting || 0;
    const active = data?.queue?.active || 0;

    if (waiting > 0 || active > 0) {
      pollRef.current = setTimeout(refreshAll, 3000);
    } else {
      pollRef.current = null;
    }
  }, [fetchStats, fetchHistory]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(refreshAll, 2000);
  }, [refreshAll]);

  const handleTriggerBulkImport = async () => {
    try {
      setImporting(true);
      await importApi.triggerBulkImport();
      showNotification('Bulk import triggered!', 'success');
      startPolling();
    } catch (error) {
      console.error('Failed to trigger bulk import:', error);
      showNotification('Failed to trigger bulk import', 'error');
    } finally {
      setImporting(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    fetchStats();
    fetchHistory();

    const socket = getSocket();

    socket.on('import:completed', () => {
      startPolling();
    });

    socket.on('import:failed', (data: { error: string }) => {
      showNotification(`Import failed: ${data.error}`, 'error');
      startPolling();
    });

    return () => {
      socket.off('import:completed');
      socket.off('import:failed');
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header onTriggerImport={handleTriggerBulkImport} importing={importing} />

      <main className="container mx-auto py-8 px-4">
        {notification && (
          <div
            className={`mb-6 flex items-center gap-3 p-4 rounded-lg border ${
              notification.type === 'error'
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : 'bg-green-50 text-green-900 border-green-200'
            }`}
          >
            {notification.type === 'error' ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
        )}

        <div className="space-y-6">
          {initialLoading ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
              <Skeleton className="h-96" />
            </>
          ) : (
            <>
              <StatsCards stats={stats} />
              <ImportHistoryTable
                logs={logs}
                onRefresh={() => fetchHistory(pageRef.current)}
              />
              <Pagination pagination={pagination} onPageChange={fetchHistory} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
