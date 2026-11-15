import { ZernioClient } from './zernio.client';
import { ZernioCreatePostPayload, ZernioCreatePostResponse } from './zernio.types';
import {
  PublishPostInput,
  NormalizedPublishResult,
  PlatformPublishResult,
  SocialPublishingError,
} from '../../types/publisher.types';
import { PlatformRouter } from '../../router/platform.router';

export class ZernioPublisher {
  private zernioClient: ZernioClient;
  private platformRouter: PlatformRouter;

  constructor(zernioClient: ZernioClient, platformRouter: PlatformRouter) {
    this.zernioClient = zernioClient;
    this.platformRouter = platformRouter;
  }

  public async publish(
    input: PublishPostInput,
    idempotencyKey: string,
    internalPostId: string
  ): Promise<NormalizedPublishResult> {
    const formattedPlatforms = this.platformRouter.formatPlatformTargets(input.platforms, input);

    const payload: ZernioCreatePostPayload = {
      platforms: formattedPlatforms,
    };

    if (input.caption && input.caption.trim()) {
      payload.content = input.caption.trim();
    }

    if (input.imageUrl && input.imageUrl.trim()) {
      payload.mediaItems = [
        {
          type: 'image',
          url: input.imageUrl.trim(),
        },
      ];
    }

    if (input.scheduledFor) {
      payload.scheduledFor = input.scheduledFor;
      if (input.timezone) {
        payload.timezone = input.timezone;
      }
    } else {
      payload.publishNow = input.publishNow !== false;
    }

    try {
      const response: ZernioCreatePostResponse = await this.zernioClient.createPost(payload, idempotencyKey);
      return this.normalizeSuccessResponse(response, input, internalPostId);
    } catch (error: any) {
      if (error instanceof SocialPublishingError) {
        return this.normalizeErrorResponse(error, input, internalPostId);
      }
      return this.normalizeErrorResponse(
        new SocialPublishingError(error.message || 'Unknown publishing error', 500),
        input,
        internalPostId
      );
    }
  }

  private normalizeSuccessResponse(
    response: ZernioCreatePostResponse,
    input: PublishPostInput,
    internalPostId: string
  ): NormalizedPublishResult {
    const zernioPost = response.post;
    const responsePlatforms = zernioPost?.platforms || response.platforms || [];
    const defaultStatus = input.scheduledFor ? 'scheduled' : 'published';
    const overallStatus = (zernioPost?.status || response.status || defaultStatus) as 'published' | 'scheduled' | 'failed' | 'partial';
    
    const platformResults: PlatformPublishResult[] = input.platforms.map((p) => {
      const respPlatform = responsePlatforms.find(
        (rp) => rp.platform.toLowerCase() === p.platform.toLowerCase()
      );

      if (respPlatform) {
        return {
          platform: p.platform,
          status: respPlatform.status || defaultStatus,
          platformPostId: respPlatform.platformPostId,
          platformPostUrl: respPlatform.platformPostUrl,
          error: respPlatform.error,
        };
      }

      return {
        platform: p.platform,
        status: defaultStatus,
      };
    });

    const hasSuccess = platformResults.some((p) => p.status === 'published' || p.status === 'scheduled');
    const hasFailure = platformResults.some((p) => p.status === 'failed');

    let finalStatus: 'published' | 'scheduled' | 'failed' | 'partial' = overallStatus;
    if (hasSuccess && hasFailure) {
      finalStatus = 'partial';
    } else if (!hasSuccess && hasFailure) {
      finalStatus = 'failed';
    }

    return {
      success: hasSuccess,
      postId: zernioPost?._id || response.id || response.postId || internalPostId,
      status: finalStatus,
      platforms: platformResults,
    };
  }

  private normalizeErrorResponse(
    error: SocialPublishingError,
    input: PublishPostInput,
    internalPostId: string
  ): NormalizedPublishResult {
    const platformResults: PlatformPublishResult[] = input.platforms.map((p) => ({
      platform: p.platform,
      status: 'failed',
      error: error.message,
    }));

    return {
      success: false,
      postId: internalPostId,
      status: 'failed',
      platforms: platformResults,
      error: error.message,
    };
  }
}

