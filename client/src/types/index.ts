export interface ImportLog {
  _id: string;
  fileName: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalFetched: number;
  totalImported: number;
  newJobs: number;
  updatedJobs: number;
  failedJobs: number;
  failedJobsDetails?: FailedJob[];
  duration?: number;
  startTime?: string;
  endTime?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FailedJob {
  jobId: string;
  reason: string;
  error: string;
  data?: any;
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ImportHistoryResponse {
  success: boolean;
  data: ImportLog[];
  pagination: PaginationData;
}

export interface StatsResponse {
  success: boolean;
  data: {
    imports: {
      total: number;
      recent: ImportLog[];
    };
    aggregate: {
      totalFetched: number;
      totalImported: number;
      totalNew: number;
      totalUpdated: number;
      totalFailed: number;
    };
    queue: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      total: number;
    };
  };
}

export interface JobFeed {
  _id: string;
  url: string;
  name: string;
  category?: string;
  jobType?: string;
  region?: string;
  isActive: boolean;
  lastFetchedAt?: string;
  lastFetchStatus?: 'success' | 'failed' | 'pending';
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}
