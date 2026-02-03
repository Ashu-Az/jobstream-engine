import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const importApi = {
  getHistory: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    fileName?: string;
  }) => {
    const response = await apiClient.get('/imports/history', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/imports/history/${id}`);
    return response.data;
  },

  triggerImport: async (url: string) => {
    const response = await apiClient.post('/imports/trigger', { url });
    return response.data;
  },

  triggerBulkImport: async () => {
    const response = await apiClient.post('/imports/trigger-bulk');
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/imports/stats');
    return response.data;
  },

  getFeeds: async () => {
    const response = await apiClient.get('/imports/feeds');
    return response.data;
  },
};

export default apiClient;
