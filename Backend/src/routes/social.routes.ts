import { Router } from 'express';
import { SocialController } from '../social/controllers/social.controller';
import { AnalyticsController } from '../social/controllers/analytics.controller';
import { PublisherService } from '../social/services/publisher.service';
import { PostRepositoryService } from '../social/services/post-repository.service';
import { AnalyticsService } from '../social/services/analytics.service';
import { PlatformRouter } from '../social/router/platform.router';
import { ZernioPublisher } from '../social/providers/zernio/zernio.publisher';
import { ZernioClient } from '../social/providers/zernio/zernio.client';
import { ZernioAnalyticsProvider } from '../social/providers/zernio/zernio.analytics';
import { AnalyticsRepositoryService } from '../social/services/analytics-repository.service';

export function createSocialRouter(
  customPublisherService?: PublisherService,
  customPostRepository?: PostRepositoryService,
  customAnalyticsService?: AnalyticsService
): Router {
  const router = Router();

  const postRepository = customPostRepository || new PostRepositoryService();
  const platformRouter = new PlatformRouter();
  const zernioClient = new ZernioClient();
  const zernioPublisher = new ZernioPublisher(zernioClient, platformRouter);

  const publisherService =
    customPublisherService || new PublisherService(platformRouter, zernioPublisher, postRepository);

  const zernioAnalyticsProvider = new ZernioAnalyticsProvider(zernioClient);
  const analyticsRepository = new AnalyticsRepositoryService();
  const analyticsService =
    customAnalyticsService ||
    new AnalyticsService(zernioAnalyticsProvider, analyticsRepository, postRepository);

  const controller = new SocialController(publisherService, postRepository);
  const analyticsController = new AnalyticsController(analyticsService);

  router.post('/publish', controller.publish);
  router.get('/posts', controller.getPosts);
  router.get('/posts/:id', controller.getPostById);
  router.get('/auth/verify', async (_req, res) => {
    const result = await zernioClient.verifyAuth();
    res.json(result);
  });

  // Analytics endpoints
  router.get('/analytics/overview', analyticsController.getOverview);
  router.get('/analytics/:postId', analyticsController.getPostAnalytics);
  router.get('/analytics/:postId/timeline', analyticsController.getPostTimeline);

  return router;
}
