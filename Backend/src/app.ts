import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { createSocialRouter } from './routes/social.routes';
import { PublisherService } from './social/services/publisher.service';
import { PostRepositoryService } from './social/services/post-repository.service';
import { AnalyticsService } from './social/services/analytics.service';

export function createApp(
  customPublisherService?: PublisherService,
  customPostRepository?: PostRepositoryService,
  customAnalyticsService?: AnalyticsService
): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve static UI for testing & dashboard
  const publicPath = path.join(__dirname, '..', '..', 'Frontend', 'public');
  app.use(express.static(publicPath));

  // Mount API endpoints
  app.use(
    '/api/social',
    createSocialRouter(customPublisherService, customPostRepository, customAnalyticsService)
  );

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Social Publishing Agent API' });
  });

  return app;
}
