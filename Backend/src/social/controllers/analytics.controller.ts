import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { SocialPublishingError } from '../types/publisher.types';

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor(analyticsService: AnalyticsService) {
    this.analyticsService = analyticsService;
  }

  public getPostAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = String(req.params.postId);
      const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
      const data = forceRefresh
        ? await this.analyticsService.getPostAnalytics(postId, true)
        : await this.analyticsService.getPostAnalytics(postId);
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof SocialPublishingError) {
        res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch post analytics' });
    }
  };

  public getPostTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const postId = String(req.params.postId);
      const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
      const data = forceRefresh
        ? await this.analyticsService.getPostTimeline(postId, true)
        : await this.analyticsService.getPostTimeline(postId);
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof SocialPublishingError) {
        res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch post timeline' });
    }
  };

  public getOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const { platform, fromDate, toDate } = req.query;
      const filter = {
        platform: platform ? String(platform) : undefined,
        fromDate: fromDate ? String(fromDate) : undefined,
        toDate: toDate ? String(toDate) : undefined,
      };

      const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
      const data = forceRefresh
        ? await this.analyticsService.getOverview(filter, true)
        : await this.analyticsService.getOverview(filter);
      res.status(200).json(data);
    } catch (error: any) {
      if (error instanceof SocialPublishingError) {
        res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch analytics overview' });
    }
  };
}
