import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/social`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // 1. Publish Post
  publishPost: async (postData) => {
    const response = await apiClient.post('/publish', postData);
    return response.data;
  },

  // 2. Get All Posts
  getPosts: async () => {
    const response = await apiClient.get('/posts');
    return response.data;
  },

  // 3. Get Post by ID
  getPostById: async (id) => {
    const response = await apiClient.get(`/posts/${id}`);
    return response.data;
  },

  // 4. Verify Auth / Accounts
  verifyAuth: async () => {
    const response = await apiClient.get('/auth/verify');
    return response.data;
  },

  // 5. Analytics Overview
  getOverview: async (params = {}, refresh = false) => {
    const finalParams = { ...params };
    if (refresh) {
      finalParams.refresh = true;
    }
    const response = await apiClient.get('/analytics/overview', { params: finalParams });
    return response.data;
  },

  // 6. Post Analytics
  getPostAnalytics: async (postId, refresh = false) => {
    const params = typeof refresh === 'boolean' ? (refresh ? { refresh: true } : {}) : refresh;
    const response = await apiClient.get(`/analytics/${postId}`, { params });
    return response.data;
  },

  // 7. Post Timeline
  getPostTimeline: async (postId, refresh = false) => {
    const params = typeof refresh === 'boolean' ? (refresh ? { refresh: true } : {}) : refresh;
    const response = await apiClient.get(`/analytics/${postId}/timeline`, { params });
    return response.data;
  },
};
