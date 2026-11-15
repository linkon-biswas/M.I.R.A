import { v4 as uuidv4 } from 'uuid';
import {
  PublishPostInput,
  NormalizedPublishResult,
  SocialPublishingError,
  PostRecord,
} from '../types/publisher.types';
import { PlatformRouter } from '../router/platform.router';
import { ZernioPublisher } from '../providers/zernio/zernio.publisher';
import { PostRepositoryService } from './post-repository.service';

export class PublisherService {
  private platformRouter: PlatformRouter;
  private zernioPublisher: ZernioPublisher;
  private postRepository: PostRepositoryService;

  constructor(
    platformRouter: PlatformRouter,
    zernioPublisher: ZernioPublisher,
    postRepository: PostRepositoryService
  ) {
    this.platformRouter = platformRouter;
    this.zernioPublisher = zernioPublisher;
    this.postRepository = postRepository;
  }

  public async publishPost(input: PublishPostInput): Promise<NormalizedPublishResult> {
    // 1. Validate basic input requirements
    this.validateInput(input);

    // 2. Platform router validation
    const platformValidation = this.platformRouter.validatePlatforms(input.platforms, input);
    if (!platformValidation.valid) {
      throw new SocialPublishingError(
        `Validation Error: ${platformValidation.errors.join(' ')}`,
        400,
        { errors: platformValidation.errors }
      );
    }

    // 3. Idempotency handling
    const idempotencyKey = input.idempotencyKey || `req_${uuidv4()}`;
    const existingRecord = await this.postRepository.findByIdempotencyKey(idempotencyKey);
    if (existingRecord) {
      return {
        success: existingRecord.status === 'published' || existingRecord.status === 'scheduled',
        postId: existingRecord.internalPostId,
        status: existingRecord.status,
        platforms: existingRecord.platforms,
      };
    }

    const internalPostId = `post_${uuidv4()}`;

    // 4. Delegate to Zernio Publisher
    const result = await this.zernioPublisher.publish(input, idempotencyKey, internalPostId);

    // 5. Store record in repository ONLY IF not completely failed or fake
    if (result.status !== 'failed') {
      const now = new Date().toISOString();
      const postRecord: PostRecord = {
        internalPostId,
        providerPostId: result.postId,
        idempotencyKey,
        caption: input.caption,
        imageUrl: input.imageUrl,
        publishNow: input.publishNow !== false && !input.scheduledFor,
        scheduledFor: input.scheduledFor,
        timezone: input.timezone,
        status: result.status,
        platforms: result.platforms,
        createdAt: now,
        updatedAt: now,
      };
      await this.postRepository.save(postRecord);
    }

    return {
      ...result,
      postId: internalPostId,
    };
  }

  private validateInput(input: PublishPostInput): void {
    if (!input) {
      throw new SocialPublishingError('Request body cannot be empty.', 400);
    }

    if (!input.platforms || !Array.isArray(input.platforms) || input.platforms.length === 0) {
      throw new SocialPublishingError('At least one platform must be specified in platforms array.', 400);
    }

    if (input.imageUrl) {
      try {
        new URL(input.imageUrl);
      } catch (_e) {
        throw new SocialPublishingError('Invalid imageUrl format. Must be a valid URL string.', 400);
      }
    }

    // Caption required for text-only posts
    if (!input.imageUrl && (!input.caption || input.caption.trim() === '')) {
      throw new SocialPublishingError('Caption is required for text posts.', 400);
    }
  }
}
