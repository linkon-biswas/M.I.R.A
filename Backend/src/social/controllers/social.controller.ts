import { Request, Response } from 'express';
import { PublisherService } from '../services/publisher.service';
import { PostRepositoryService } from '../services/post-repository.service';
import { publishPostSchema } from '../validation/social.validation';
import { SocialPublishingError } from '../types/publisher.types';

export class SocialController {
  private publisherService: PublisherService;
  private postRepository: PostRepositoryService;

  constructor(publisherService: PublisherService, postRepository: PostRepositoryService) {
    this.publisherService = publisherService;
    this.postRepository = postRepository;
  }

  public publish = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate schema
      const parseResult = publishPostSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        res.status(400).json({
          success: false,
          error: `Validation error: ${errorMessages}`,
        });
        return;
      }

      const input = parseResult.data;
      // Also allow x-idempotency-key or x-request-id header if provided
      if (!input.idempotencyKey) {
        input.idempotencyKey = (req.headers['x-idempotency-key'] || req.headers['x-request-id']) as string | undefined;
      }

      const result = await this.publisherService.publishPost(input);
      
      const statusCode = result.success ? 200 : result.status === 'partial' ? 207 : 400;
      res.status(statusCode).json(result);
    } catch (err: any) {
      if (err instanceof SocialPublishingError) {
        res.status(err.statusCode).json({
          success: false,
          error: err.message,
          details: err.details,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'An unexpected internal error occurred while processing social publish request.',
      });
    }
  };

  public getPosts = async (_req: Request, res: Response): Promise<void> => {
    const posts = await this.postRepository.listAll();
    res.json({
      success: true,
      count: posts.length,
      posts,
    });
  };

  public getPostById = async (req: Request, res: Response): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const post = await this.postRepository.findById(id);
    if (!post) {
      res.status(404).json({
        success: false,
        error: `Post with ID '${id}' not found.`,
      });
      return;
    }
    res.json({
      success: true,
      post,
    });
  };
}
