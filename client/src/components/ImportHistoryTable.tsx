'use client';

import { useState } from 'react';
import { ImportLog } from '@/types';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, FileText, Clock, AlertCircle } from 'lucide-react';

interface Props {
  logs: ImportLog[];
  onRefresh: () => void;
}

export default function ImportHistoryTable({ logs, onRefresh }: Props) {
  const [selectedLog, setSelectedLog] = useState<ImportLog | null>(null);

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Import History</CardTitle>
            </div>
            <Button onClick={onRefresh} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No import history available</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <TableCell className="font-medium max-w-xs truncate">
                        {log.fileName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="mr-2 h-4 w-4" />
                          {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(log.status)}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {log.totalImported}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {log.newJobs}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">
                        {log.updatedJobs}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {log.failedJobs}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDuration(log.duration)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">File Name</p>
                <p className="mt-1 break-all">{selectedLog.fileName}</p>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className="mt-1" variant={getStatusVariant(selectedLog.status)}>
                  {selectedLog.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total</p>
                  <p className="mt-1 text-2xl font-bold">{selectedLog.totalImported}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatDuration(selectedLog.duration)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New</p>
                  <p className="mt-1 text-xl font-bold text-green-600">
                    {selectedLog.newJobs}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Updated</p>
                  <p className="mt-1 text-xl font-bold text-blue-600">
                    {selectedLog.updatedJobs}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed</p>
                  <p className="mt-1 text-xl font-bold text-red-600">
                    {selectedLog.failedJobs}
                  </p>
                </div>
              </div>

              {selectedLog.error && (
                <>
                  <Separator />
                  <div className="rounded-lg bg-destructive/10 p-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 mr-2" />
                      <div>
                        <p className="font-medium text-destructive">Error</p>
                        <p className="mt-1 text-sm">{selectedLog.error}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedLog.failedJobsDetails && selectedLog.failedJobsDetails.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Failed Jobs Details
                    </p>
                    <div className="space-y-2">
                      {selectedLog.failedJobsDetails.slice(0, 5).map((job, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border bg-muted/50 p-3 text-sm"
                        >
                          <p className="font-medium">{job.jobId}</p>
                          <p className="mt-1 text-muted-foreground">{job.reason}</p>
                        </div>
                      ))}
                      {selectedLog.failedJobsDetails.length > 5 && (
                        <p className="text-sm text-muted-foreground">
                          ... and {selectedLog.failedJobsDetails.length - 5} more
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
