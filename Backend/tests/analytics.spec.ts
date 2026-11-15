import request from 'supertest';
import { createApp } from '../src/app';
import { ZernioAnalyticsProvider, calculateEngagementRate } from '../src/social/providers/zernio/zernio.analytics';
import { AnalyticsService } from '../src/social/services/analytics.service';
import { AnalyticsRepositoryService } from '../src/social/services/analytics-repository.service';
import { PostRepositoryService } from '../src/social/services/post-repository.service';
import { SocialPublishingError } from '../src/social/types/publisher.types';

describe('Analytics Layer Unit & Integration Tests', () => {
  describe('calculateEngagementRate', () => {
    test('calculates correct engagement rate based on reach', () => {
      const rate = calculateEngagementRate({
        reach: 1000,
        impressions: 1200,
        likes: 50,
        comments: 10,
        shares: 5,
        clicks: 15,
        views: 100,
      });
      // (50 + 10 + 5 + 15) / 1000 * 100 = 8.00%
      expect(rate).toBe(8);
    });

    test('falls back to impressions when reach is 0', () => {
      const rate = calculateEngagementRate({
        reach: 0,
        impressions: 500,
        likes: 10,
        comments: 5,
        shares: 0,
        clicks: 5,
      });
      // (10 + 5 + 5) / 500 * 100 = 4.00%
      expect(rate).toBe(4);
    });

    test('returns 0 when both reach and impressions are 0', () => {
      const rate = calculateEngagementRate({
        reach: 0,
        impressions: 0,
        likes: 10,
        comments: 5,
        shares: 0,
        clicks: 5,
      });
      expect(rate).toBe(0);
    });
  });

  describe('ZernioAnalyticsProvider', () => {
    let mockZernioClient: any;
    let provider: ZernioAnalyticsProvider;

    beforeEach(() => {
      mockZernioClient = {
        getAnalytics: jest.fn(),
        getPostTimeline: jest.fn(),
        getDailyMetrics: jest.fn(),
      };
      provider = new ZernioAnalyticsProvider(mockZernioClient);
    });

    test('getPostAnalytics returns normalized metrics with reactionBreakdown null when unsupported', async () => {
      mockZernioClient.getAnalytics.mockResolvedValueOnce({
        posts: [
          {
            _id: 'zernio_post_100',
            platform: 'facebook',
            platformPostUrl: 'https://facebook.com/post_100',
            analytics: {
              impressions: 1500,
              reach: 1200,
              likes: 80,
              comments: 12,
              shares: 9,
              saves: 2,
              clicks: 23,
              views: 0,
            },
          },
        ],
      });

      mockZernioClient.getPostTimeline.mockResolvedValueOnce({
        timeline: [
          {
            date: '2026-09-24',
            impressions: 1500,
            reach: 1200,
            likes: 80,
            comments: 12,
            shares: 9,
            saves: 2,
            clicks: 23,
            views: 0,
          },
        ],
      });

      const result = await provider.getPostAnalytics('zernio_post_100');

      expect(result).not.toBeNull();
      expect(result?.postId).toBe('zernio_post_100');
      expect(result?.platform).toBe('facebook');
      expect(result?.metrics.impressions).toBe(1500);
      expect(result?.metrics.reach).toBe(1200);
      expect(result?.metrics.likes).toBe(80);
      expect(result?.metrics.engagementRate).toBeGreaterThan(0);
      expect(result?.reactionBreakdown).toBeNull();
      expect(result?.timeline.length).toBe(1);
    });

    test('getPostAnalytics handles reactionBreakdown when provided by upstream API', async () => {
      mockZernioClient.getAnalytics.mockResolvedValueOnce({
        posts: [
          {
            _id: 'zernio_post_200',
            platform: 'facebook',
            analytics: {
              impressions: 2000,
              reach: 1500,
              likes: 100,
              comments: 20,
              shares: 10,
              clicks: 30,
              views: 0,
              reactionBreakdown: {
                like: 70,
                love: 20,
                haha: 5,
                wow: 3,
                sad: 1,
                angry: 1,
              },
            },
          },
        ],
      });

      mockZernioClient.getPostTimeline.mockResolvedValueOnce({ timeline: [] });

      const result = await provider.getPostAnalytics('zernio_post_200');

      expect(result?.reactionBreakdown).toEqual({
        like: 70,
        love: 20,
        haha: 5,
        wow: 3,
        sad: 1,
        angry: 1,
      });
    });

    test('getOverview calculates aggregated analytics across platforms', async () => {
      mockZernioClient.getDailyMetrics.mockResolvedValueOnce({
        platformBreakdown: [
          {
            platform: 'facebook',
            postCount: 5,
            impressions: 5000,
            reach: 4000,
            likes: 200,
            comments: 50,
            shares: 30,
            clicks: 80,
            views: 0,
          },
        ],
      });

      mockZernioClient.getAnalytics.mockResolvedValueOnce({
        overview: { totalPosts: 5 },
      });

      const overview = await provider.getOverview();

      expect(overview.totalPosts).toBe(5);
      expect(overview.impressions).toBe(5000);
      expect(overview.reach).toBe(4000);
      expect(overview.likes).toBe(200);
      expect(overview.engagementRate).toBeGreaterThan(0);
    });
  });

  describe('AnalyticsService & Caching', () => {
    let mockProvider: any;
    let repoCache: AnalyticsRepositoryService;
    let postRepo: PostRepositoryService;
    let service: AnalyticsService;

    beforeEach(() => {
      mockProvider = {
        getPostAnalytics: jest.fn(),
        getPostTimeline: jest.fn(),
        getOverview: jest.fn(),
      };
      repoCache = new AnalyticsRepositoryService(300);
      postRepo = new PostRepositoryService();
      service = new AnalyticsService(mockProvider, repoCache, postRepo);
    });

    test('caches analytics responses and prevents duplicate upstream API calls', async () => {
      mockProvider.getPostAnalytics.mockResolvedValueOnce({
        postId: 'post_cached_1',
        platform: 'facebook',
        metrics: { impressions: 100, reach: 90, likes: 10, comments: 2, shares: 1, saves: 0, clicks: 5, views: 0, engagementRate: 20 },
        reactionBreakdown: null,
        timeline: [],
        fetchedAt: new Date().toISOString(),
      });

      const res1 = await service.getPostAnalytics('post_cached_1');
      const res2 = await service.getPostAnalytics('post_cached_1');

      expect(res1).toEqual(res2);
      expect(mockProvider.getPostAnalytics).toHaveBeenCalledTimes(1);
    });

    test('distinguishes "no data yet" for locally published posts vs 404 for unknown posts', async () => {
      // Create a local post in postRepo
      postRepo.save({
        internalPostId: 'internal_post_123',
        idempotencyKey: 'req_123',
        publishNow: true,
        platforms: [{ platform: 'facebook', status: 'published' }],
        caption: 'Test post',
        status: 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockProvider.getPostAnalytics.mockResolvedValueOnce(null);

      // Local post present -> returns "no_data_yet" status response gracefully
      const res = await service.getPostAnalytics('internal_post_123');
      expect(res.status).toBe('no_data_yet');
      expect(res.metrics.impressions).toBe(0);

      // Non-existent post -> throws 404
      mockProvider.getPostAnalytics.mockResolvedValueOnce(null);
      await expect(service.getPostAnalytics('unknown_post_xyz')).rejects.toThrow('Post analytics not found');
    });

    test('bypasses in-memory cache when forceRefresh is true for getPostAnalytics and getOverview', async () => {
      const mockPostAnalytics1 = {
        postId: 'post_bypass_1',
        platform: 'facebook',
        metrics: { impressions: 100, reach: 90, likes: 10, comments: 2, shares: 1, saves: 0, clicks: 5, views: 0, engagementRate: 20 },
        reactionBreakdown: null,
        timeline: [],
        fetchedAt: new Date().toISOString(),
      };
      const mockPostAnalytics2 = {
        ...mockPostAnalytics1,
        metrics: { ...mockPostAnalytics1.metrics, likes: 30 },
      };

      mockProvider.getPostAnalytics
        .mockResolvedValueOnce(mockPostAnalytics1)
        .mockResolvedValueOnce(mockPostAnalytics2);

      // Initial call populates cache
      const res1 = await service.getPostAnalytics('post_bypass_1');
      expect(res1.metrics.likes).toBe(10);
      expect(mockProvider.getPostAnalytics).toHaveBeenCalledTimes(1);

      // Calling with forceRefresh = false returns cached response
      const cachedRes = await service.getPostAnalytics('post_bypass_1');
      expect(cachedRes.metrics.likes).toBe(10);
      expect(mockProvider.getPostAnalytics).toHaveBeenCalledTimes(1);

      // Calling with forceRefresh = true bypasses cache and fetches fresh provider data
      const refreshedRes = await service.getPostAnalytics('post_bypass_1', true);
      expect(refreshedRes.metrics.likes).toBe(30);
      expect(mockProvider.getPostAnalytics).toHaveBeenCalledTimes(2);

      // Overview test:
      const filter = { platform: 'facebook' };
      const overview1 = { totalPosts: 5, impressions: 500 };
      const overview2 = { totalPosts: 8, impressions: 800 };

      mockProvider.getOverview
        .mockResolvedValueOnce(overview1)
        .mockResolvedValueOnce(overview2);

      const oRes1 = await service.getOverview(filter);
      expect(oRes1.overview.totalPosts).toBe(5);
      expect(mockProvider.getOverview).toHaveBeenCalledTimes(1);

      const oResCached = await service.getOverview(filter);
      expect(oResCached.overview.totalPosts).toBe(5);
      expect(mockProvider.getOverview).toHaveBeenCalledTimes(1);

      const oResRefreshed = await service.getOverview(filter, true);
      expect(oResRefreshed.overview.totalPosts).toBe(8);
      expect(mockProvider.getOverview).toHaveBeenCalledTimes(2);
    });

    test('getPostTimeline does NOT cache an empty timeline array', async () => {
      // First call: provider returns empty array
      mockProvider.getPostTimeline.mockResolvedValueOnce([]);

      const res1 = await service.getPostTimeline('post_empty_tl');
      expect(res1.timeline).toEqual([]);
      expect(mockProvider.getPostTimeline).toHaveBeenCalledTimes(1);

      // Cache should remain empty
      expect(repoCache.getTimeline('post_empty_tl')).toBeNull();

      // Second call: provider returns populated timeline
      const populatedTimeline = [
        { date: '2026-09-24', impressions: 150, reach: 120, likes: 10, comments: 2, shares: 1, saves: 0, clicks: 3, views: 0, engagementRate: 10.83 },
      ];
      mockProvider.getPostTimeline.mockResolvedValueOnce(populatedTimeline);

      const res2 = await service.getPostTimeline('post_empty_tl');
      expect(res2.timeline).toEqual(populatedTimeline);
      expect(mockProvider.getPostTimeline).toHaveBeenCalledTimes(2);

      // Third call without forceRefresh: should now be served from cache
      const res3 = await service.getPostTimeline('post_empty_tl');
      expect(res3.timeline).toEqual(populatedTimeline);
      expect(mockProvider.getPostTimeline).toHaveBeenCalledTimes(2);
    });
  });

  describe('API Endpoints (supertest)', () => {
    let app: any;
    let mockAnalyticsService: any;

    beforeEach(() => {
      mockAnalyticsService = {
        getPostAnalytics: jest.fn(),
        getPostTimeline: jest.fn(),
        getOverview: jest.fn(),
      };
      app = createApp(undefined, undefined, mockAnalyticsService as any);
    });

    test('GET /api/social/analytics/overview returns aggregated metrics', async () => {
      mockAnalyticsService.getOverview.mockResolvedValueOnce({
        success: true,
        overview: {
          totalPosts: 10,
          impressions: 10000,
          reach: 8000,
          likes: 500,
          comments: 100,
          shares: 50,
          clicks: 200,
          views: 0,
          engagementRate: 10.63,
        },
      });

      const res = await request(app).get('/api/social/analytics/overview?platform=facebook');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overview.totalPosts).toBe(10);
      expect(mockAnalyticsService.getOverview).toHaveBeenCalledWith({
        platform: 'facebook',
        fromDate: undefined,
        toDate: undefined,
      });
    });

    test('GET /api/social/analytics/:postId returns post analytics', async () => {
      mockAnalyticsService.getPostAnalytics.mockResolvedValueOnce({
        postId: 'p_123',
        platform: 'facebook',
        metrics: {
          impressions: 1500,
          reach: 1200,
          likes: 80,
          comments: 12,
          shares: 9,
          clicks: 23,
          views: 0,
          engagementRate: 10.33,
        },
        reactionBreakdown: null,
        timeline: [],
      });

      const res = await request(app).get('/api/social/analytics/p_123');

      expect(res.status).toBe(200);
      expect(res.body.postId).toBe('p_123');
      expect(res.body.metrics.likes).toBe(80);
      expect(res.body.reactionBreakdown).toBeNull();
    });

    test('GET /api/social/analytics/:postId/timeline returns timeline data', async () => {
      mockAnalyticsService.getPostTimeline.mockResolvedValueOnce({
        postId: 'p_123',
        timeline: [
          { date: '2026-09-24', impressions: 100, reach: 90, likes: 5, comments: 1, shares: 0, saves: 0, clicks: 2, views: 0, engagementRate: 8.89 },
        ],
      });

      const res = await request(app).get('/api/social/analytics/p_123/timeline');

      expect(res.status).toBe(200);
      expect(res.body.postId).toBe('p_123');
      expect(res.body.timeline.length).toBe(1);
    });

    test('GET /api/social/analytics/:postId returns 404 for invalid post', async () => {
      mockAnalyticsService.getPostAnalytics.mockRejectedValueOnce(
        new SocialPublishingError('Post analytics not found for ID: unknown', 404)
      );

      const res = await request(app).get('/api/social/analytics/unknown');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    test('GET /api/social/analytics/overview?platform=facebook&refresh=true passes forceRefresh true to getOverview', async () => {
      mockAnalyticsService.getOverview.mockResolvedValueOnce({
        success: true,
        overview: { totalPosts: 12 },
      });

      const res = await request(app).get('/api/social/analytics/overview?platform=facebook&refresh=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAnalyticsService.getOverview).toHaveBeenCalledWith(
        {
          platform: 'facebook',
          fromDate: undefined,
          toDate: undefined,
        },
        true
      );
    });

    test('GET /api/social/analytics/:postId?refresh=true passes forceRefresh true to getPostAnalytics', async () => {
      mockAnalyticsService.getPostAnalytics.mockResolvedValueOnce({
        postId: 'p_refresh_test',
        platform: 'facebook',
        metrics: { impressions: 100 },
      });

      const res = await request(app).get('/api/social/analytics/p_refresh_test?refresh=true');

      expect(res.status).toBe(200);
      expect(mockAnalyticsService.getPostAnalytics).toHaveBeenCalledWith('p_refresh_test', true);
    });

    test('GET /api/social/analytics/:postId/timeline?refresh=1 passes forceRefresh true to getPostTimeline', async () => {
      mockAnalyticsService.getPostTimeline.mockResolvedValueOnce({
        postId: 'p_refresh_test',
        timeline: [],
      });

      const res = await request(app).get('/api/social/analytics/p_refresh_test/timeline?refresh=1');

      expect(res.status).toBe(200);
      expect(mockAnalyticsService.getPostTimeline).toHaveBeenCalledWith('p_refresh_test', true);
    });
  });
});
