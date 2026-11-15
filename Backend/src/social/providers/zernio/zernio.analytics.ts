import { ZernioClient } from './zernio.client';

import {
  SocialAnalyticsProvider,
  NormalizedPostAnalytics,
  NormalizedTimelinePoint,
  NormalizedAnalyticsOverview,
  AnalyticsOverviewFilter,
  ReactionBreakdown,
  NormalizedPostMetrics,
} from '../../types/analytics.types';

export function calculateEngagementRate(metrics: {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  views?: number;
}): number {
  const engagements =
    (metrics.likes || 0) +
    (metrics.comments || 0) +
    (metrics.shares || 0) +
    (metrics.clicks || 0);

  const denominator =
    metrics.reach > 0
      ? metrics.reach
      : metrics.impressions > 0
        ? metrics.impressions
        : 0;

  if (denominator === 0) {
    return 0;
  }

  return Number(((engagements / denominator) * 100).toFixed(2));
}

export class ZernioAnalyticsProvider implements SocialAnalyticsProvider {
  private zernioClient: ZernioClient;

  constructor(zernioClient: ZernioClient) {
    this.zernioClient = zernioClient;
  }

  public async getPostAnalytics(
    postId: string
  ): Promise<NormalizedPostAnalytics | null> {
    const rawData = await this.zernioClient.getAnalytics({
      limit: 100,
    });

    console.log(
      '[ZernioAnalytics] RAW ANALYTICS:',
      JSON.stringify(rawData, null, 2)
    );

    const posts: any[] = Array.isArray(rawData?.posts)
      ? rawData.posts
      : [];

    console.log(
      '[ZernioAnalytics] SEARCHING FOR POST ID:',
      postId
    );

    console.log(
      '[ZernioAnalytics] TOTAL POSTS:',
      posts.length
    );

    const foundPost = posts.find((p) => {
      const platformMatches = Array.isArray(p?.platforms)
        ? p.platforms.some(
          (pl: any) =>
            String(pl?.platformPostId || '') === String(postId) ||
            String(pl?.postId || '') === String(postId) ||
            String(pl?.id || '') === String(postId)
        )
        : false;

      const directMatch =
        String(p?._id || '') === String(postId) ||
        String(p?.id || '') === String(postId) ||
        String(p?.postId || '') === String(postId) ||
        String(p?.zernioPostId || '') === String(postId) ||
        String(p?.latePostId || '') === String(postId) ||
        String(p?.platformPostId || '') === String(postId);

      return directMatch || platformMatches;
    });

    if (!foundPost) {
      console.log(
        '[ZernioAnalytics] POST NOT FOUND:',
        postId
      );

      console.log(
        '[ZernioAnalytics] AVAILABLE POST IDS:',
        posts.map((p) => ({
          _id: p?._id,
          id: p?.id,
          postId: p?.postId,
          zernioPostId: p?.zernioPostId,
          latePostId: p?.latePostId,
          platformPostId: p?.platformPostId,
          platforms: Array.isArray(p?.platforms)
            ? p.platforms.map((pl: any) => ({
              platform: pl?.platform,
              platformPostId: pl?.platformPostId,
              postId: pl?.postId,
              id: pl?.id,
            }))
            : [],
        }))
      );

      return null;
    }

    console.log(
      '[ZernioAnalytics] FOUND POST:',
      JSON.stringify(foundPost, null, 2)
    );

    const rawAnalytics = foundPost.analytics || {};

    const firstPlatform =
      Array.isArray(foundPost.platforms) &&
        foundPost.platforms.length > 0
        ? foundPost.platforms[0]
        : undefined;

    const platform =
      foundPost.platform ||
      firstPlatform?.platform ||
      'facebook';

    // IMPORTANT:
    // Keep the actual platform post ID.
    // Do not use platformPostUrl here.
    const platformPostId =
      foundPost.platformPostId ||
      firstPlatform?.platformPostId ||
      undefined;

    const impressions = Number(
      rawAnalytics.impressions || 0
    );

    const reach = Number(
      rawAnalytics.reach || 0
    );

    const likes = Number(
      rawAnalytics.likes || 0
    );

    const comments = Number(
      rawAnalytics.comments || 0
    );

    const shares = Number(
      rawAnalytics.shares || 0
    );

    const saves = Number(
      rawAnalytics.saves || 0
    );

    const clicks = Number(
      rawAnalytics.clicks || 0
    );

    const views = Number(
      rawAnalytics.views || 0
    );

    /*
     * IMPORTANT FIX:
     *
     * Do NOT trust Zernio's engagementRate blindly.
     *
     * We calculate it from the normalized metrics so that
     * post analytics and timeline use exactly the same formula.
     *
     * Example:
     * likes=0
     * comments=0
     * shares=0
     * clicks=1
     * reach=2
     *
     * => 1 / 2 * 100 = 50%
     */
    const engagementRate = calculateEngagementRate({
      reach,
      impressions,
      likes,
      comments,
      shares,
      clicks,
      views,
    });

    const metrics: NormalizedPostMetrics = {
      impressions,
      reach,
      likes,
      comments,
      shares,
      saves,
      clicks,
      views,
      engagementRate,
    };

    let reactionBreakdown: ReactionBreakdown | null = null;

    if (
      rawAnalytics.reactionBreakdown &&
      typeof rawAnalytics.reactionBreakdown === 'object'
    ) {
      reactionBreakdown = {
        like: Number(
          rawAnalytics.reactionBreakdown.like || 0
        ),
        love: Number(
          rawAnalytics.reactionBreakdown.love || 0
        ),
        haha: Number(
          rawAnalytics.reactionBreakdown.haha || 0
        ),
        wow: Number(
          rawAnalytics.reactionBreakdown.wow || 0
        ),
        sad: Number(
          rawAnalytics.reactionBreakdown.sad || 0
        ),
        angry: Number(
          rawAnalytics.reactionBreakdown.angry || 0
        ),
      };
    }

    let timeline: NormalizedTimelinePoint[] = [];

    try {
      const timelinePostId =
        foundPost._id ||
        foundPost.id ||
        foundPost.postId ||
        postId;

      timeline = await this.getPostTimeline(
        timelinePostId
      );
    } catch (error) {
      console.log(
        '[ZernioAnalytics] TIMELINE FETCH FAILED:',
        error instanceof Error
          ? error.message
          : error
      );

      timeline = [];
    }

    return {
      postId:
        foundPost._id ||
        foundPost.id ||
        foundPost.postId ||
        postId,

      platform,

      platformPostId,

      metrics,

      reactionBreakdown,

      timeline,

      fetchedAt: new Date().toISOString(),
    };
  }

  public async getPostTimeline(
    postId: string
  ): Promise<NormalizedTimelinePoint[]> {
    const rawTimelineData =
      await this.zernioClient.getPostTimeline(postId);

    const points: any[] =
      Array.isArray(rawTimelineData?.timeline)
        ? rawTimelineData.timeline
        : [];

    return points.map((p) => {
      const impressions = Number(
        p.impressions || 0
      );

      const reach = Number(
        p.reach || 0
      );

      const likes = Number(
        p.likes || 0
      );

      const comments = Number(
        p.comments || 0
      );

      const shares = Number(
        p.shares || 0
      );

      const saves = Number(
        p.saves || 0
      );

      const clicks = Number(
        p.clicks || 0
      );

      const views = Number(
        p.views || 0
      );

      const engagementRate =
        calculateEngagementRate({
          reach,
          impressions,
          likes,
          comments,
          shares,
          clicks,
          views,
        });

      return {
        date:
          p.date ||
          new Date()
            .toISOString()
            .split('T')[0],

        impressions,
        reach,
        likes,
        comments,
        shares,
        saves,
        clicks,
        views,
        engagementRate,
      };
    });
  }

  public async getOverview(
    filter?: AnalyticsOverviewFilter
  ): Promise<NormalizedAnalyticsOverview> {
    const dailyDataRaw =
      await this.zernioClient.getDailyMetrics({
        fromDate: filter?.fromDate,
        toDate: filter?.toDate,
        platform: filter?.platform,
      });

    const analyticsRaw =
      await this.zernioClient.getAnalytics({
        limit: 100,
      });

    const overviewRaw =
      analyticsRaw?.overview || {};

    const platformBreakdown: any[] =
      Array.isArray(
        dailyDataRaw?.platformBreakdown
      )
        ? dailyDataRaw.platformBreakdown
        : [];

    let filteredBreakdown =
      platformBreakdown;

    if (filter?.platform) {
      filteredBreakdown =
        platformBreakdown.filter(
          (pb) =>
            String(
              pb?.platform || ''
            ).toLowerCase() ===
            filter.platform!.toLowerCase()
        );
    }

    /*
     * IMPORTANT FIX:
     *
     * Without a platform filter, use Zernio's overview.totalPosts
     * as the primary total post count.
     *
     * Previously platformBreakdown.postCount was being used first,
     * which produced 13 even though analytics overview reported 6.
     *
     * When a specific platform filter is requested, use that
     * platform's breakdown count.
     */
    const totalPosts = filter?.platform
      ? Number(
        filteredBreakdown.reduce(
          (sum: number, pb: any) =>
            sum +
            Number(
              pb?.postCount || 0
            ),
          0
        )
      )
      : Number(
        overviewRaw?.totalPosts || 0
      );

    const impressions = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.impressions || 0
          ),
        0
      )
    );

    const reach = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.reach || 0
          ),
        0
      )
    );

    const likes = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.likes || 0
          ),
        0
      )
    );

    const comments = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.comments || 0
          ),
        0
      )
    );

    const shares = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.shares || 0
          ),
        0
      )
    );

    const clicks = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.clicks || 0
          ),
        0
      )
    );

    const views = Number(
      filteredBreakdown.reduce(
        (sum: number, pb: any) =>
          sum +
          Number(
            pb?.views || 0
          ),
        0
      )
    );

    const engagementRate =
      calculateEngagementRate({
        reach,
        impressions,
        likes,
        comments,
        shares,
        clicks,
        views,
      });

    return {
      totalPosts,
      impressions,
      reach,
      likes,
      comments,
      shares,
      clicks,
      views,
      engagementRate,
    };
  }
}




// import { ZernioClient } from './zernio.client';
// import {
//   SocialAnalyticsProvider,
//   NormalizedPostAnalytics,
//   NormalizedTimelinePoint,
//   NormalizedAnalyticsOverview,
//   AnalyticsOverviewFilter,
//   ReactionBreakdown,
//   NormalizedPostMetrics,
// } from '../../types/analytics.types';

// export function calculateEngagementRate(metrics: {
//   reach: number;
//   impressions: number;
//   likes: number;
//   comments: number;
//   shares: number;
//   clicks: number;
//   views?: number;
// }): number {
//   const engagements =
//     (metrics.likes || 0) +
//     (metrics.comments || 0) +
//     (metrics.shares || 0) +
//     (metrics.clicks || 0);

//   const denominator =
//     metrics.reach > 0
//       ? metrics.reach
//       : metrics.impressions > 0
//         ? metrics.impressions
//         : 0;

//   if (denominator === 0) {
//     return 0;
//   }

//   return Number(((engagements / denominator) * 100).toFixed(2));
// }

// export class ZernioAnalyticsProvider implements SocialAnalyticsProvider {
//   private zernioClient: ZernioClient;

//   constructor(zernioClient: ZernioClient) {
//     this.zernioClient = zernioClient;
//   }

//   public async getPostAnalytics(
//     postId: string
//   ): Promise<NormalizedPostAnalytics | null> {
//     const rawData = await this.zernioClient.getAnalytics({
//       limit: 100,
//     });

//     const posts: any[] = Array.isArray(rawData?.posts)
//       ? rawData.posts
//       : [];

//     console.log(
//       '[ZernioAnalytics] SEARCHING FOR POST ID:',
//       postId
//     );

//     console.log(
//       '[ZernioAnalytics] TOTAL POSTS:',
//       posts.length
//     );

//     const targetId = String(postId || '').trim();

//     const foundPost = posts.find((p: any) => {
//       const directIds = [
//         p?._id,
//         p?.id,
//         p?.postId,
//         p?.zernioPostId,
//         p?.latePostId,
//         p?.platformPostId,
//       ]
//         .filter(Boolean)
//         .map((value: any) => String(value));

//       if (directIds.includes(targetId)) {
//         return true;
//       }

//       if (Array.isArray(p?.platforms)) {
//         return p.platforms.some((pl: any) => {
//           const platformIds = [
//             pl?.platformPostId,
//             pl?.postId,
//             pl?.id,
//             pl?.zernioPostId,
//             pl?.latePostId,
//           ]
//             .filter(Boolean)
//             .map((value: any) => String(value));

//           return platformIds.includes(targetId);
//         });
//       }

//       return false;
//     });

//     if (!foundPost) {
//       console.log(
//         '[ZernioAnalytics] POST NOT FOUND:',
//         postId
//       );

//       console.log(
//         '[ZernioAnalytics] AVAILABLE POST IDS:',
//         posts.map((p: any) => ({
//           _id: p?._id,
//           id: p?.id,
//           postId: p?.postId,
//           zernioPostId: p?.zernioPostId,
//           latePostId: p?.latePostId,
//           platformPostId: p?.platformPostId,
//           platformPostIds: Array.isArray(p?.platforms)
//             ? p.platforms.map((pl: any) => ({
//               platform: pl?.platform,
//               platformPostId: pl?.platformPostId,
//               postId: pl?.postId,
//               id: pl?.id,
//               zernioPostId: pl?.zernioPostId,
//               latePostId: pl?.latePostId,
//             }))
//             : [],
//         }))
//       );

//       return null;
//     }

//     console.log(
//       '[ZernioAnalytics] FOUND POST:',
//       JSON.stringify(foundPost, null, 2)
//     );

//     const rawAnalytics = foundPost.analytics || {};

//     const firstPlatform =
//       Array.isArray(foundPost.platforms) &&
//         foundPost.platforms.length > 0
//         ? foundPost.platforms[0]
//         : undefined;

//     const platform =
//       foundPost.platform ||
//       firstPlatform?.platform ||
//       'facebook';

//     const platformPostId =
//       foundPost.platformPostId ||
//       firstPlatform?.platformPostId ||
//       undefined;

//     const impressions = Number(
//       rawAnalytics.impressions || 0
//     );

//     const reach = Number(
//       rawAnalytics.reach || 0
//     );

//     const likes = Number(
//       rawAnalytics.likes || 0
//     );

//     const comments = Number(
//       rawAnalytics.comments || 0
//     );

//     const shares = Number(
//       rawAnalytics.shares || 0
//     );

//     const saves = Number(
//       rawAnalytics.saves || 0
//     );

//     const clicks = Number(
//       rawAnalytics.clicks || 0
//     );

//     const views = Number(
//       rawAnalytics.views || 0
//     );

//     const engagementRate =
//       typeof rawAnalytics.engagementRate === 'number'
//         ? Number(
//           rawAnalytics.engagementRate.toFixed(2)
//         )
//         : calculateEngagementRate({
//           reach,
//           impressions,
//           likes,
//           comments,
//           shares,
//           clicks,
//           views,
//         });

//     const metrics: NormalizedPostMetrics = {
//       impressions,
//       reach,
//       likes,
//       comments,
//       shares,
//       saves,
//       clicks,
//       views,
//       engagementRate,
//     };

//     let reactionBreakdown: ReactionBreakdown | null = null;

//     if (
//       rawAnalytics.reactionBreakdown &&
//       typeof rawAnalytics.reactionBreakdown === 'object'
//     ) {
//       reactionBreakdown = {
//         like: Number(
//           rawAnalytics.reactionBreakdown.like || 0
//         ),
//         love: Number(
//           rawAnalytics.reactionBreakdown.love || 0
//         ),
//         haha: Number(
//           rawAnalytics.reactionBreakdown.haha || 0
//         ),
//         wow: Number(
//           rawAnalytics.reactionBreakdown.wow || 0
//         ),
//         sad: Number(
//           rawAnalytics.reactionBreakdown.sad || 0
//         ),
//         angry: Number(
//           rawAnalytics.reactionBreakdown.angry || 0
//         ),
//       };
//     }

//     let timeline: NormalizedTimelinePoint[] = [];

//     const timelineCandidates = [
//       foundPost?._id,
//       foundPost?.id,
//       foundPost?.postId,
//       foundPost?.zernioPostId,
//       foundPost?.latePostId,
//       firstPlatform?.platformPostId,
//       firstPlatform?.postId,
//       firstPlatform?.id,
//       postId,
//     ]
//       .filter(Boolean)
//       .map((value: any) => String(value))
//       .filter(
//         (value: string, index: number, arr: string[]) =>
//           arr.indexOf(value) === index
//       );

//     for (const timelinePostId of timelineCandidates) {
//       try {
//         const result =
//           await this.getPostTimeline(timelinePostId);

//         if (result.length > 0) {
//           timeline = result;
//           break;
//         }
//       } catch (error) {
//         console.log(
//           '[ZernioAnalytics] TIMELINE ATTEMPT FAILED:',
//           timelinePostId,
//           error instanceof Error
//             ? error.message
//             : error
//         );
//       }
//     }

//     return {
//       postId:
//         foundPost?._id ||
//         foundPost?.id ||
//         foundPost?.postId ||
//         foundPost?.zernioPostId ||
//         foundPost?.latePostId ||
//         postId,

//       platform,

//       platformPostId,

//       metrics,

//       reactionBreakdown,

//       timeline,

//       fetchedAt: new Date().toISOString(),
//     };
//   }

//   public async getPostTimeline(
//     postId: string
//   ): Promise<NormalizedTimelinePoint[]> {
//     const rawTimelineData =
//       await this.zernioClient.getPostTimeline(postId);

//     const points: any[] = Array.isArray(
//       rawTimelineData?.timeline
//     )
//       ? rawTimelineData.timeline
//       : [];

//     return points.map((p: any) => {
//       const impressions = Number(
//         p?.impressions || 0
//       );

//       const reach = Number(
//         p?.reach || 0
//       );

//       const likes = Number(
//         p?.likes || 0
//       );

//       const comments = Number(
//         p?.comments || 0
//       );

//       const shares = Number(
//         p?.shares || 0
//       );

//       const saves = Number(
//         p?.saves || 0
//       );

//       const clicks = Number(
//         p?.clicks || 0
//       );

//       const views = Number(
//         p?.views || 0
//       );

//       const engagementRate =
//         calculateEngagementRate({
//           reach,
//           impressions,
//           likes,
//           comments,
//           shares,
//           clicks,
//           views,
//         });

//       return {
//         date:
//           p?.date ||
//           new Date()
//             .toISOString()
//             .split('T')[0],

//         impressions,
//         reach,
//         likes,
//         comments,
//         shares,
//         saves,
//         clicks,
//         views,
//         engagementRate,
//       };
//     });
//   }

//   public async getOverview(
//     filter?: AnalyticsOverviewFilter
//   ): Promise<NormalizedAnalyticsOverview> {
//     const dailyDataRaw =
//       await this.zernioClient.getDailyMetrics({
//         fromDate: filter?.fromDate,
//         toDate: filter?.toDate,
//         platform: filter?.platform,
//       });

//     const analyticsRaw =
//       await this.zernioClient.getAnalytics({
//         limit: 100,
//       });

//     const overviewRaw =
//       analyticsRaw?.overview || {};

//     const platformBreakdown: any[] =
//       Array.isArray(
//         dailyDataRaw?.platformBreakdown
//       )
//         ? dailyDataRaw.platformBreakdown
//         : [];

//     let filteredBreakdown =
//       platformBreakdown;

//     if (filter?.platform) {
//       filteredBreakdown =
//         platformBreakdown.filter(
//           (pb: any) =>
//             String(
//               pb?.platform || ''
//             ).toLowerCase() ===
//             filter.platform!.toLowerCase()
//         );
//     }

//     const totalPosts = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.postCount || 0),
//         0
//       ) ||
//       Number(
//         overviewRaw?.totalPosts || 0
//       )
//     );

//     const impressions = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(
//             pb?.impressions || 0
//           ),
//         0
//       )
//     );

//     const reach = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(pb?.reach || 0),
//         0
//       )
//     );

//     const likes = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(pb?.likes || 0),
//         0
//       )
//     );

//     const comments = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(
//             pb?.comments || 0
//           ),
//         0
//       )
//     );

//     const shares = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(pb?.shares || 0),
//         0
//       )
//     );

//     const clicks = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(pb?.clicks || 0),
//         0
//       )
//     );

//     const views = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum +
//           Number(pb?.views || 0),
//         0
//       )
//     );

//     const engagementRate =
//       calculateEngagementRate({
//         reach,
//         impressions,
//         likes,
//         comments,
//         shares,
//         clicks,
//         views,
//       });

//     return {
//       totalPosts,
//       impressions,
//       reach,
//       likes,
//       comments,
//       shares,
//       clicks,
//       views,
//       engagementRate,
//     };
//   }
// }




// import { ZernioClient } from './zernio.client';
// import {
//   SocialAnalyticsProvider,
//   NormalizedPostAnalytics,
//   NormalizedTimelinePoint,
//   NormalizedAnalyticsOverview,
//   AnalyticsOverviewFilter,
//   ReactionBreakdown,
//   NormalizedPostMetrics,
// } from '../../types/analytics.types';

// export function calculateEngagementRate(metrics: {
//   reach: number;
//   impressions: number;
//   likes: number;
//   comments: number;
//   shares: number;
//   clicks: number;
//   views?: number;
// }): number {
//   const engagements =
//     (metrics.likes || 0) +
//     (metrics.comments || 0) +
//     (metrics.shares || 0) +
//     (metrics.clicks || 0);

//   const denominator =
//     metrics.reach > 0
//       ? metrics.reach
//       : metrics.impressions > 0
//         ? metrics.impressions
//         : 0;

//   if (denominator === 0) return 0;

//   return Number(((engagements / denominator) * 100).toFixed(2));
// }

// export class ZernioAnalyticsProvider implements SocialAnalyticsProvider {
//   private zernioClient: ZernioClient;

//   constructor(zernioClient: ZernioClient) {
//     this.zernioClient = zernioClient;
//   }

//   public async getPostAnalytics(
//     postId: string
//   ): Promise<NormalizedPostAnalytics | null> {
//     const rawData = await this.zernioClient.getAnalytics({ limit: 100 });

//     // TEMP DEBUG:
//     // This will show the exact Zernio analytics response.
//     console.log(
//       '[ZernioAnalytics] RAW ANALYTICS:',
//       JSON.stringify(rawData, null, 2)
//     );

//     const posts: any[] = Array.isArray(rawData?.posts)
//       ? rawData.posts
//       : [];

//     console.log(
//       '[ZernioAnalytics] SEARCHING FOR POST ID:',
//       postId
//     );

//     console.log(
//       '[ZernioAnalytics] TOTAL POSTS:',
//       posts.length
//     );

//     /*
//      * Zernio may return IDs in different places depending on
//      * the analytics response:
//      *
//      * p._id
//      * p.id
//      * p.postId
//      * p.zernioPostId
//      * p.latePostId
//      * p.platformPostId
//      * p.platforms[].platformPostId
//      * p.platforms[].postId
//      */
//     const foundPost = posts.find((p) => {
//       const platformMatches = Array.isArray(p?.platforms)
//         ? p.platforms.some(
//           (pl: any) =>
//             String(pl?.platformPostId || '') === String(postId) ||
//             String(pl?.postId || '') === String(postId) ||
//             String(pl?.id || '') === String(postId)
//         )
//         : false;

//       const directMatch =
//         String(p?._id || '') === String(postId) ||
//         String(p?.id || '') === String(postId) ||
//         String(p?.postId || '') === String(postId) ||
//         String(p?.zernioPostId || '') === String(postId) ||
//         String(p?.latePostId || '') === String(postId) ||
//         String(p?.platformPostId || '') === String(postId);

//       return directMatch || platformMatches;
//     });

//     if (!foundPost) {
//       console.log(
//         '[ZernioAnalytics] POST NOT FOUND:',
//         postId
//       );

//       // Helpful debug output so we can see what IDs Zernio actually returned.
//       console.log(
//         '[ZernioAnalytics] AVAILABLE POST IDS:',
//         posts.map((p) => ({
//           _id: p?._id,
//           id: p?.id,
//           postId: p?.postId,
//           zernioPostId: p?.zernioPostId,
//           latePostId: p?.latePostId,
//           platformPostId: p?.platformPostId,
//           platforms: Array.isArray(p?.platforms)
//             ? p.platforms.map((pl: any) => ({
//               platform: pl?.platform,
//               platformPostId: pl?.platformPostId,
//               postId: pl?.postId,
//               id: pl?.id,
//             }))
//             : [],
//         }))
//       );

//       return null;
//     }

//     console.log(
//       '[ZernioAnalytics] FOUND POST:',
//       JSON.stringify(foundPost, null, 2)
//     );

//     const rawAnalytics = foundPost.analytics || {};

//     const firstPlatform =
//       Array.isArray(foundPost.platforms) && foundPost.platforms.length > 0
//         ? foundPost.platforms[0]
//         : undefined;

//     const platform =
//       foundPost.platform ||
//       firstPlatform?.platform ||
//       'facebook';

//     /*
//      * IMPORTANT:
//      * The previous code accidentally used platformPostUrl
//      * as platformPostId.
//      *
//      * Correct order:
//      * platformPostId first,
//      * URL separately if needed.
//      */
//     const platformPostId =
//       foundPost.platformPostId ||
//       firstPlatform?.platformPostId ||
//       undefined;

//     const impressions = Number(rawAnalytics.impressions || 0);
//     const reach = Number(rawAnalytics.reach || 0);
//     const likes = Number(rawAnalytics.likes || 0);
//     const comments = Number(rawAnalytics.comments || 0);
//     const shares = Number(rawAnalytics.shares || 0);
//     const saves = Number(rawAnalytics.saves || 0);
//     const clicks = Number(rawAnalytics.clicks || 0);
//     const views = Number(rawAnalytics.views || 0);

//     const engagementRate =
//       typeof rawAnalytics.engagementRate === 'number' &&
//         rawAnalytics.engagementRate >= 0
//         ? Number(rawAnalytics.engagementRate.toFixed(2))
//         : calculateEngagementRate({
//           reach,
//           impressions,
//           likes,
//           comments,
//           shares,
//           clicks,
//           views,
//         });

//     const metrics: NormalizedPostMetrics = {
//       impressions,
//       reach,
//       likes,
//       comments,
//       shares,
//       saves,
//       clicks,
//       views,
//       engagementRate,
//     };

//     // Reaction breakdown
//     let reactionBreakdown: ReactionBreakdown | null = null;

//     if (
//       rawAnalytics.reactionBreakdown &&
//       typeof rawAnalytics.reactionBreakdown === 'object'
//     ) {
//       reactionBreakdown = {
//         like: Number(rawAnalytics.reactionBreakdown.like || 0),
//         love: Number(rawAnalytics.reactionBreakdown.love || 0),
//         haha: Number(rawAnalytics.reactionBreakdown.haha || 0),
//         wow: Number(rawAnalytics.reactionBreakdown.wow || 0),
//         sad: Number(rawAnalytics.reactionBreakdown.sad || 0),
//         angry: Number(rawAnalytics.reactionBreakdown.angry || 0),
//       };
//     }

//     // Timeline is optional.
//     let timeline: NormalizedTimelinePoint[] = [];

//     try {
//       const timelinePostId =
//         foundPost._id ||
//         foundPost.id ||
//         foundPost.postId ||
//         postId;

//       timeline = await this.getPostTimeline(timelinePostId);
//     } catch (error) {
//       console.log(
//         '[ZernioAnalytics] TIMELINE FETCH FAILED:',
//         error instanceof Error ? error.message : error
//       );

//       // Timeline is optional, so analytics can still be returned.
//       timeline = [];
//     }

//     return {
//       postId:
//         foundPost._id ||
//         foundPost.id ||
//         foundPost.postId ||
//         postId,

//       platform,

//       platformPostId,

//       metrics,

//       reactionBreakdown,

//       timeline,

//       fetchedAt: new Date().toISOString(),
//     };
//   }

//   public async getPostTimeline(
//     postId: string
//   ): Promise<NormalizedTimelinePoint[]> {
//     const rawTimelineData =
//       await this.zernioClient.getPostTimeline(postId);

//     const points: any[] = Array.isArray(rawTimelineData?.timeline)
//       ? rawTimelineData.timeline
//       : [];

//     return points.map((p) => {
//       const impressions = Number(p.impressions || 0);
//       const reach = Number(p.reach || 0);
//       const likes = Number(p.likes || 0);
//       const comments = Number(p.comments || 0);
//       const shares = Number(p.shares || 0);
//       const saves = Number(p.saves || 0);
//       const clicks = Number(p.clicks || 0);
//       const views = Number(p.views || 0);

//       const engagementRate = calculateEngagementRate({
//         reach,
//         impressions,
//         likes,
//         comments,
//         shares,
//         clicks,
//         views,
//       });

//       return {
//         date:
//           p.date ||
//           new Date().toISOString().split('T')[0],

//         impressions,
//         reach,
//         likes,
//         comments,
//         shares,
//         saves,
//         clicks,
//         views,
//         engagementRate,
//       };
//     });
//   }

//   public async getOverview(
//     filter?: AnalyticsOverviewFilter
//   ): Promise<NormalizedAnalyticsOverview> {
//     const dailyDataRaw =
//       await this.zernioClient.getDailyMetrics({
//         fromDate: filter?.fromDate,
//         toDate: filter?.toDate,
//         platform: filter?.platform,
//       });

//     const analyticsRaw =
//       await this.zernioClient.getAnalytics({
//         limit: 100,
//       });

//     const overviewRaw = analyticsRaw.overview || {};

//     const platformBreakdown: any[] =
//       Array.isArray(dailyDataRaw?.platformBreakdown)
//         ? dailyDataRaw.platformBreakdown
//         : [];

//     let filteredBreakdown = platformBreakdown;

//     if (filter?.platform) {
//       filteredBreakdown = platformBreakdown.filter(
//         (pb) =>
//           String(pb?.platform || '').toLowerCase() ===
//           filter.platform!.toLowerCase()
//       );
//     }

//     const totalPosts = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.postCount || 0),
//         0
//       ) ||
//       overviewRaw.totalPosts ||
//       0
//     );

//     const impressions = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.impressions || 0),
//         0
//       )
//     );

//     const reach = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.reach || 0),
//         0
//       )
//     );

//     const likes = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.likes || 0),
//         0
//       )
//     );

//     const comments = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.comments || 0),
//         0
//       )
//     );

//     const shares = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.shares || 0),
//         0
//       )
//     );

//     const clicks = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.clicks || 0),
//         0
//       )
//     );

//     const views = Number(
//       filteredBreakdown.reduce(
//         (sum: number, pb: any) =>
//           sum + Number(pb?.views || 0),
//         0
//       )
//     );

//     const engagementRate = calculateEngagementRate({
//       reach,
//       impressions,
//       likes,
//       comments,
//       shares,
//       clicks,
//       views,
//     });

//     return {
//       totalPosts,
//       impressions,
//       reach,
//       likes,
//       comments,
//       shares,
//       clicks,
//       views,
//       engagementRate,
//     };
//   }
// }




// import { ZernioClient } from './zernio.client';
// import {
//   SocialAnalyticsProvider,
//   NormalizedPostAnalytics,
//   NormalizedTimelinePoint,
//   NormalizedAnalyticsOverview,
//   AnalyticsOverviewFilter,
//   ReactionBreakdown,
//   NormalizedPostMetrics,
// } from '../../types/analytics.types';

// export function calculateEngagementRate(metrics: {
//   reach: number;
//   impressions: number;
//   likes: number;
//   comments: number;
//   shares: number;
//   clicks: number;
//   views?: number;
// }): number {
//   const engagements = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0) + (metrics.clicks || 0);
//   const denominator = metrics.reach > 0 ? metrics.reach : metrics.impressions > 0 ? metrics.impressions : 0;
//   if (denominator === 0) return 0;
//   return Number(((engagements / denominator) * 100).toFixed(2));
// }

// export class ZernioAnalyticsProvider implements SocialAnalyticsProvider {
//   private zernioClient: ZernioClient;

//   constructor(zernioClient: ZernioClient) {
//     this.zernioClient = zernioClient;
//   }

//   public async getPostAnalytics(postId: string): Promise<NormalizedPostAnalytics | null> {
//     const rawData = await this.zernioClient.getAnalytics({ limit: 100 });
//     const posts: any[] = rawData.posts || [];

//     const foundPost = posts.find(
//       (p) =>
//         p._id === postId ||
//         p.latePostId === postId ||
//         p.id === postId ||
//         p.platforms?.some((pl: any) => pl.platformPostId === postId)
//     );

//     if (!foundPost) {
//       return null;
//     }

//     const rawAnalytics = foundPost.analytics || {};
//     const platform = foundPost.platform || (foundPost.platforms && foundPost.platforms[0]?.platform) || 'facebook';
//     const platformPostId =
//       foundPost.platformPostUrl ||
//       (foundPost.platforms && foundPost.platforms[0]?.platformPostId) ||
//       undefined;

//     const impressions = Number(rawAnalytics.impressions || 0);
//     const reach = Number(rawAnalytics.reach || 0);
//     const likes = Number(rawAnalytics.likes || 0);
//     const comments = Number(rawAnalytics.comments || 0);
//     const shares = Number(rawAnalytics.shares || 0);
//     const saves = Number(rawAnalytics.saves || 0);
//     const clicks = Number(rawAnalytics.clicks || 0);
//     const views = Number(rawAnalytics.views || 0);

//     const engagementRate =
//       typeof rawAnalytics.engagementRate === 'number' && rawAnalytics.engagementRate > 0
//         ? Number(rawAnalytics.engagementRate.toFixed(2))
//         : calculateEngagementRate({ reach, impressions, likes, comments, shares, clicks, views });

//     const metrics: NormalizedPostMetrics = {
//       impressions,
//       reach,
//       likes,
//       comments,
//       shares,
//       saves,
//       clicks,
//       views,
//       engagementRate,
//     };

//     // Reaction breakdown logic: check if upstream provided detailed reactionBreakdown object
//     let reactionBreakdown: ReactionBreakdown | null = null;
//     if (
//       rawAnalytics.reactionBreakdown &&
//       typeof rawAnalytics.reactionBreakdown === 'object' &&
//       typeof rawAnalytics.reactionBreakdown.like === 'number'
//     ) {
//       reactionBreakdown = {
//         like: Number(rawAnalytics.reactionBreakdown.like || 0),
//         love: Number(rawAnalytics.reactionBreakdown.love || 0),
//         haha: Number(rawAnalytics.reactionBreakdown.haha || 0),
//         wow: Number(rawAnalytics.reactionBreakdown.wow || 0),
//         sad: Number(rawAnalytics.reactionBreakdown.sad || 0),
//         angry: Number(rawAnalytics.reactionBreakdown.angry || 0),
//       };
//     }

//     // Try fetching timeline for this post safely
//     let timeline: NormalizedTimelinePoint[] = [];
//     try {
//       timeline = await this.getPostTimeline(foundPost._id || postId);
//     } catch {
//       // Timeline optional/fallback if unavailable
//     }

//     return {
//       postId: foundPost._id || postId,
//       platform,
//       platformPostId,
//       metrics,
//       reactionBreakdown,
//       timeline,
//       fetchedAt: new Date().toISOString(),
//     };
//   }

//   public async getPostTimeline(postId: string): Promise<NormalizedTimelinePoint[]> {
//     const rawTimelineData = await this.zernioClient.getPostTimeline(postId);
//     const points: any[] = rawTimelineData.timeline || [];

//     return points.map((p) => {
//       const impressions = Number(p.impressions || 0);
//       const reach = Number(p.reach || 0);
//       const likes = Number(p.likes || 0);
//       const comments = Number(p.comments || 0);
//       const shares = Number(p.shares || 0);
//       const saves = Number(p.saves || 0);
//       const clicks = Number(p.clicks || 0);
//       const views = Number(p.views || 0);

//       const engagementRate = calculateEngagementRate({
//         reach,
//         impressions,
//         likes,
//         comments,
//         shares,
//         clicks,
//         views,
//       });

//       return {
//         date: p.date || new Date().toISOString().split('T')[0],
//         impressions,
//         reach,
//         likes,
//         comments,
//         shares,
//         saves,
//         clicks,
//         views,
//         engagementRate,
//       };
//     });
//   }

//   public async getOverview(filter?: AnalyticsOverviewFilter): Promise<NormalizedAnalyticsOverview> {
//     const dailyDataRaw = await this.zernioClient.getDailyMetrics({
//       fromDate: filter?.fromDate,
//       toDate: filter?.toDate,
//       platform: filter?.platform,
//     });

//     const analyticsRaw = await this.zernioClient.getAnalytics({ limit: 100 });
//     const overviewRaw = analyticsRaw.overview || {};
//     const platformBreakdown: any[] = dailyDataRaw.platformBreakdown || [];

//     let filteredBreakdown = platformBreakdown;
//     if (filter?.platform) {
//       filteredBreakdown = platformBreakdown.filter(
//         (pb) => pb.platform.toLowerCase() === filter.platform!.toLowerCase()
//       );
//     }

//     const totalPosts = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.postCount || 0), 0) ||
//         overviewRaw.totalPosts ||
//         0
//     );
//     const impressions = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.impressions || 0), 0)
//     );
//     const reach = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.reach || 0), 0)
//     );
//     const likes = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.likes || 0), 0)
//     );
//     const comments = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.comments || 0), 0)
//     );
//     const shares = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.shares || 0), 0)
//     );
//     const clicks = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.clicks || 0), 0)
//     );
//     const views = Number(
//       filteredBreakdown.reduce((sum: number, pb: any) => sum + (pb.views || 0), 0)
//     );

//     const engagementRate = calculateEngagementRate({
//       reach,
//       impressions,
//       likes,
//       comments,
//       shares,
//       clicks,
//       views,
//     });

//     return {
//       totalPosts,
//       impressions,
//       reach,
//       likes,
//       comments,
//       shares,
//       clicks,
//       views,
//       engagementRate,
//     };
//   }
// }
