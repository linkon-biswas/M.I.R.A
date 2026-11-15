import {
  SocialAnalyticsProvider,
  AnalyticsOverviewFilter,
  NormalizedPostAnalytics,
} from '../types/analytics.types';

import { AnalyticsRepositoryService } from './analytics-repository.service';
import { PostRepositoryService } from './post-repository.service';
import { SocialPublishingError } from '../types/publisher.types';
import { getDbPool } from '../../db';
import { v4 as uuidv4 } from 'uuid';

export class AnalyticsService {
  private analyticsProvider: SocialAnalyticsProvider;
  private analyticsRepository: AnalyticsRepositoryService;
  private postRepository: PostRepositoryService;

  constructor(
    analyticsProvider: SocialAnalyticsProvider,
    analyticsRepository?: AnalyticsRepositoryService,
    postRepository?: PostRepositoryService
  ) {
    this.analyticsProvider = analyticsProvider;
    this.analyticsRepository =
      analyticsRepository ||
      new AnalyticsRepositoryService();

    this.postRepository =
      postRepository ||
      new PostRepositoryService();
  }

  public async getPostAnalytics(
    postId: string,
    forceRefresh: boolean = false
  ): Promise<any> {
    if (!forceRefresh) {
      const cached =
        this.analyticsRepository.getPostAnalytics(
          postId
        );

      if (cached) {
        return cached;
      }
    }

    try {
      /*
       * Get local post first.
       *
       * This is important because the requested ID may be
       * our internal post ID while Zernio uses another ID.
       */
      const localPost =
        await this.postRepository.findById(
          postId
        );

      /*
       * Build every possible identifier we know about
       * this post.
       */
      const candidateIds: string[] = [];

      const addCandidate = (
        value: unknown
      ): void => {
        if (
          value === undefined ||
          value === null
        ) {
          return;
        }

        const valueString =
          String(value).trim();

        if (
          valueString &&
          !candidateIds.includes(valueString)
        ) {
          candidateIds.push(valueString);
        }
      };

      /*
       * Try repository DB mapping.
       */
      const resolvedZernioPostId =
        await this.postRepository.resolveZernioPostId(
          postId
        );

      addCandidate(
        resolvedZernioPostId
      );

      addCandidate(postId);

      /*
       * If local post exists, add provider and
       * platform-specific IDs.
       */
      if (localPost) {
        addCandidate(
          localPost.providerPostId
        );

        if (
          Array.isArray(
            localPost.platforms
          )
        ) {
          for (const platform of localPost.platforms) {
            addCandidate(
              platform.platformPostId
            );
          }
        }
      }

      console.log(
        '[AnalyticsService] POST ANALYTICS CANDIDATE IDS:',
        candidateIds
      );

      let analytics:
        | NormalizedPostAnalytics
        | null = null;

      /*
       * Try every known ID until Zernio returns
       * a matching analytics record.
       */
      for (const candidateId of candidateIds) {
        try {
          console.log(
            '[AnalyticsService] TRYING ZERNIO ANALYTICS ID:',
            candidateId
          );

          analytics =
            await this.analyticsProvider.getPostAnalytics(
              candidateId
            );

          if (analytics) {
            console.log(
              '[AnalyticsService] ANALYTICS FOUND USING ID:',
              candidateId
            );

            break;
          }
        } catch (error) {
          console.warn(
            '[AnalyticsService] ANALYTICS ATTEMPT FAILED:',
            candidateId,
            error instanceof Error
              ? error.message
              : error
          );
        }
      }

      if (analytics) {
        /*
         * Always expose our application's internal
         * post ID to the frontend.
         */
        const responseData:
          NormalizedPostAnalytics = {
          ...analytics,
          postId,
        };

        this.analyticsRepository.setPostAnalytics(
          postId,
          responseData
        );

        /*
         * Persist using the Zernio ID that actually
         * matched, if possible.
         */
        const matchedZernioId =
          candidateIds.find(
            (candidateId) =>
              candidateId !== postId
          ) ||
          resolvedZernioPostId ||
          postId;

        await this.persistAnalyticsSnapshot(
          postId,
          matchedZernioId,
          responseData
        );

        return responseData;
      }

      /*
       * No upstream analytics yet.
       *
       * If the local post exists, this is NOT a 404.
       * The post exists; analytics simply are not
       * available yet.
       */
      if (localPost) {
        return {
          postId,

          platform:
            localPost.platforms?.[0]
              ?.platform ||
            'facebook',

          status: 'no_data_yet',

          message:
            'Post exists, but analytics data is not available from Zernio yet.',

          metrics: {
            impressions: 0,
            reach: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
            views: 0,
            engagementRate: 0,
          },

          reactionBreakdown: null,

          timeline: [],

          fetchedAt:
            new Date().toISOString(),
        };
      }

      throw new SocialPublishingError(
        `Post analytics not found for ID: ${postId}`,
        404
      );
    } catch (error: any) {
      if (
        error instanceof SocialPublishingError
      ) {
        throw error;
      }

      throw new SocialPublishingError(
        `Failed to fetch analytics for post ${postId}: ${error?.message || 'Unknown error'
        }`,
        500
      );
    }
  }

  public async getPostTimeline(
    postId: string,
    forceRefresh: boolean = false
  ): Promise<any> {
    if (!forceRefresh) {
      const cached =
        this.analyticsRepository.getTimeline(
          postId
        );

      if (cached) {
        return {
          postId,
          timeline: cached,
        };
      }
    }

    const localPost =
      await this.postRepository.findById(
        postId
      );

    const candidateIds: string[] = [];

    const addCandidate = (
      value: unknown
    ): void => {
      if (
        value === undefined ||
        value === null
      ) {
        return;
      }

      const valueString =
        String(value).trim();

      if (
        valueString &&
        !candidateIds.includes(valueString)
      ) {
        candidateIds.push(valueString);
      }
    };

    const resolvedZernioPostId =
      await this.postRepository.resolveZernioPostId(
        postId
      );

    addCandidate(
      resolvedZernioPostId
    );

    addCandidate(postId);

    if (localPost) {
      addCandidate(
        localPost.providerPostId
      );

      if (
        Array.isArray(
          localPost.platforms
        )
      ) {
        for (const platform of localPost.platforms) {
          addCandidate(
            platform.platformPostId
          );
        }
      }
    }

    let timeline: any[] = [];

    for (const candidateId of candidateIds) {
      try {
        console.log(
          '[AnalyticsService] TRYING TIMELINE ID:',
          candidateId
        );

        const result =
          await this.analyticsProvider.getPostTimeline(
            candidateId
          );

        if (
          Array.isArray(result) &&
          result.length > 0
        ) {
          timeline = result;
          break;
        }
      } catch (error) {
        console.warn(
          '[AnalyticsService] TIMELINE ATTEMPT FAILED:',
          candidateId,
          error instanceof Error
            ? error.message
            : error
        );
      }
    }

    if (timeline.length > 0) {
      this.analyticsRepository.setTimeline(
        postId,
        timeline
      );
    }

    return {
      postId,
      timeline,
    };
  }

  public async getOverview(
    filter?: AnalyticsOverviewFilter,
    forceRefresh: boolean = false
  ): Promise<any> {
    const filterKey =
      JSON.stringify(filter || {});

    if (!forceRefresh) {
      const cached =
        this.analyticsRepository.getOverview(
          filterKey
        );

      if (cached) {
        return {
          success: true,
          overview: cached,
        };
      }
    }

    try {
      const overview =
        await this.analyticsProvider.getOverview(
          filter
        );

      this.analyticsRepository.setOverview(
        filterKey,
        overview
      );

      return {
        success: true,
        overview,
      };
    } catch (error: any) {
      if (
        error instanceof SocialPublishingError
      ) {
        throw error;
      }

      throw new SocialPublishingError(
        `Failed to fetch analytics overview: ${error?.message ||
        'Unknown error'
        }`,
        500
      );
    }
  }

  private async persistAnalyticsSnapshot(
    internalPostId: string,
    zernioPostId: string,
    analytics: NormalizedPostAnalytics
  ): Promise<void> {
    const pool = getDbPool();

    if (!pool) {
      return;
    }

    try {
      const pfRes =
        await pool.query(
          `SELECT id
           FROM post_platforms
           WHERE post_id = $1
              OR zernio_post_id = $2
              OR platform_post_id = $2
           LIMIT 1`,
          [
            internalPostId,
            zernioPostId,
          ]
        );

      if (
        pfRes.rows.length === 0
      ) {
        return;
      }

      const postPlatformId =
        pfRes.rows[0].id;

      const snapshotId =
        `snap_${uuidv4()}`;

      const m =
        analytics.metrics;

      await pool.query(
        `INSERT INTO analytics_snapshots
         (
           id,
           post_platform_id,
           impressions,
           reach,
           likes,
           comments,
           shares,
           saves,
           clicks,
           views,
           engagement_rate,
           fetched_at
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10,
           $11,
           $12
         )`,
        [
          snapshotId,
          postPlatformId,
          m.impressions,
          m.reach,
          m.likes,
          m.comments,
          m.shares,
          m.saves,
          m.clicks,
          m.views,
          m.engagementRate,
          new Date(),
        ]
      );

      if (
        analytics.timeline &&
        analytics.timeline.length > 0
      ) {
        for (const pt of analytics.timeline) {
          const timelineId =
            `tl_${uuidv4()}`;

          await pool.query(
            `INSERT INTO analytics_timeline
             (
               id,
               post_platform_id,
               date,
               impressions,
               reach,
               likes,
               comments,
               shares,
               saves,
               clicks,
               views,
               engagement_rate
             )
             VALUES
             (
               $1,
               $2,
               $3,
               $4,
               $5,
               $6,
               $7,
               $8,
               $9,
               $10,
               $11,
               $12
             )
             ON CONFLICT DO NOTHING`,
            [
              timelineId,
              postPlatformId,
              pt.date,
              pt.impressions,
              pt.reach,
              pt.likes,
              pt.comments,
              pt.shares,
              pt.saves,
              pt.clicks,
              pt.views,
              pt.engagementRate,
            ]
          );
        }
      }
    } catch (err) {
      console.error(
        '[AnalyticsService] Error persisting analytics snapshot:',
        err
      );
    }
  }
}



// import { SocialAnalyticsProvider, AnalyticsOverviewFilter, NormalizedPostAnalytics } from '../types/analytics.types';
// import { AnalyticsRepositoryService } from './analytics-repository.service';
// import { PostRepositoryService } from './post-repository.service';
// import { SocialPublishingError } from '../types/publisher.types';
// import { getDbPool } from '../../db';
// import { v4 as uuidv4 } from 'uuid';

// export class AnalyticsService {
//   private analyticsProvider: SocialAnalyticsProvider;
//   private analyticsRepository: AnalyticsRepositoryService;
//   private postRepository: PostRepositoryService;

//   constructor(
//     analyticsProvider: SocialAnalyticsProvider,
//     analyticsRepository?: AnalyticsRepositoryService,
//     postRepository?: PostRepositoryService
//   ) {
//     this.analyticsProvider = analyticsProvider;
//     this.analyticsRepository = analyticsRepository || new AnalyticsRepositoryService();
//     this.postRepository = postRepository || new PostRepositoryService();
//   }

//   public async getPostAnalytics(postId: string): Promise<any> {
//     // Check in-memory/TTL cache first
//     const cached = this.analyticsRepository.getPostAnalytics(postId);
//     if (cached) {
//       return cached;
//     }

//     // Resolve internal postId -> zernioPostId using PostRepository mapping
//     const zernioPostId = await this.postRepository.resolveZernioPostId(postId);

//     try {
//       // Call Zernio provider with resolved Zernio post ID (or postId)
//       let analytics = await this.analyticsProvider.getPostAnalytics(zernioPostId);
//       if (!analytics && zernioPostId !== postId) {
//         // Fallback check with original postId if different
//         analytics = await this.analyticsProvider.getPostAnalytics(postId);
//       }

//       if (analytics) {
//         // Ensure returned analytics preserves requested internal postId or platformPostId
//         const responseData: NormalizedPostAnalytics = {
//           ...analytics,
//           postId: postId,
//         };

//         this.analyticsRepository.setPostAnalytics(postId, responseData);
//         await this.persistAnalyticsSnapshot(postId, zernioPostId, responseData);
//         return responseData;
//       }
//     } catch (error: any) {
//       if (error instanceof SocialPublishingError) {
//         throw error;
//       }
//       throw new SocialPublishingError(`Failed to fetch analytics for post ${postId}: ${error.message}`, 500);
//     }

//     // If analytics not found from upstream, check if post exists in local repository
//     const localPost = await this.postRepository.findById(postId);
//     if (localPost) {
//       return {
//         postId,
//         platform: localPost.platforms[0]?.platform || 'facebook',
//         status: 'no_data_yet',
//         message: 'Analytics data is being processed or not available yet.',
//         metrics: {
//           impressions: 0,
//           reach: 0,
//           likes: 0,
//           comments: 0,
//           shares: 0,
//           saves: 0,
//           clicks: 0,
//           views: 0,
//           engagementRate: 0,
//         },
//         reactionBreakdown: null,
//         timeline: [],
//         fetchedAt: new Date().toISOString(),
//       };
//     }

//     throw new SocialPublishingError(`Post analytics not found for ID: ${postId}`, 404);
//   }

//   public async getPostTimeline(postId: string): Promise<any> {
//     const cached = this.analyticsRepository.getTimeline(postId);
//     if (cached) {
//       return { postId, timeline: cached };
//     }

//     const zernioPostId = await this.postRepository.resolveZernioPostId(postId);

//     try {
//       let timeline = await this.analyticsProvider.getPostTimeline(zernioPostId);
//       if ((!timeline || timeline.length === 0) && zernioPostId !== postId) {
//         timeline = await this.analyticsProvider.getPostTimeline(postId);
//       }
//       this.analyticsRepository.setTimeline(postId, timeline);
//       return { postId, timeline };
//     } catch (error: any) {
//       if (error instanceof SocialPublishingError) {
//         throw error;
//       }
//       throw new SocialPublishingError(`Failed to fetch timeline for post ${postId}: ${error.message}`, 500);
//     }
//   }

//   public async getOverview(filter?: AnalyticsOverviewFilter): Promise<any> {
//     const filterKey = JSON.stringify(filter || {});
//     const cached = this.analyticsRepository.getOverview(filterKey);
//     if (cached) {
//       return { success: true, overview: cached };
//     }

//     try {
//       const overview = await this.analyticsProvider.getOverview(filter);
//       this.analyticsRepository.setOverview(filterKey, overview);
//       return { success: true, overview };
//     } catch (error: any) {
//       if (error instanceof SocialPublishingError) {
//         throw error;
//       }
//       throw new SocialPublishingError(`Failed to fetch analytics overview: ${error.message}`, 500);
//     }
//   }

//   private async persistAnalyticsSnapshot(internalPostId: string, zernioPostId: string, analytics: NormalizedPostAnalytics): Promise<void> {
//     const pool = getDbPool();
//     if (!pool) return;

//     try {
//       const pfRes = await pool.query(
//         `SELECT id FROM post_platforms 
//          WHERE post_id = $1 OR zernio_post_id = $2 OR platform_post_id = $2 
//          LIMIT 1`,
//         [internalPostId, zernioPostId]
//       );

//       if (pfRes.rows.length === 0) return;
//       const postPlatformId = pfRes.rows[0].id;

//       const snapshotId = `snap_${uuidv4()}`;
//       const m = analytics.metrics;

//       await pool.query(
//         `INSERT INTO analytics_snapshots 
//          (id, post_platform_id, impressions, reach, likes, comments, shares, saves, clicks, views, engagement_rate, fetched_at)
//          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
//         [
//           snapshotId,
//           postPlatformId,
//           m.impressions,
//           m.reach,
//           m.likes,
//           m.comments,
//           m.shares,
//           m.saves,
//           m.clicks,
//           m.views,
//           m.engagementRate,
//           new Date(),
//         ]
//       );

//       if (analytics.timeline && analytics.timeline.length > 0) {
//         for (const pt of analytics.timeline) {
//           const timelineId = `tl_${uuidv4()}`;
//           await pool.query(
//             `INSERT INTO analytics_timeline 
//              (id, post_platform_id, date, impressions, reach, likes, comments, shares, saves, clicks, views, engagement_rate)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
//              ON CONFLICT DO NOTHING`,
//             [
//               timelineId,
//               postPlatformId,
//               pt.date,
//               pt.impressions,
//               pt.reach,
//               pt.likes,
//               pt.comments,
//               pt.shares,
//               pt.saves,
//               pt.clicks,
//               pt.views,
//               pt.engagementRate,
//             ]
//           );
//         }
//       }
//     } catch (err) {
//       console.error('[AnalyticsService] Error persisting analytics snapshot:', err);
//     }
//   }
// }
