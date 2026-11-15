import { v4 as uuidv4 } from 'uuid';
import { PostRecord } from '../types/publisher.types';
import { getDbPool } from '../../db';

export class PostRepositoryService {
  private posts: Map<
    string,
    PostRecord
  > = new Map();

  private idempotencyMap: Map<
    string,
    string
  > = new Map();

  public async save(
    post: PostRecord
  ): Promise<void> {
    this.posts.set(
      post.internalPostId,
      post
    );

    if (post.idempotencyKey) {
      this.idempotencyMap.set(
        post.idempotencyKey,
        post.internalPostId
      );
    }

    const pool = getDbPool();

    if (pool) {
      const client =
        await pool.connect();

      try {
        await client.query(
          'BEGIN'
        );

        const publishedAt =
          post.status ===
            'published'
            ? new Date()
            : null;

        await client.query(
          `INSERT INTO posts
           (
             id,
             idempotency_key,
             caption,
             media_url,
             status,
             created_at,
             published_at
           )
           VALUES
           (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7
           )
           ON CONFLICT (id)
           DO UPDATE SET
             status = EXCLUDED.status,
             caption = EXCLUDED.caption,
             media_url = EXCLUDED.media_url,
             published_at = EXCLUDED.published_at`,
          [
            post.internalPostId,
            post.idempotencyKey,
            post.caption || null,
            post.imageUrl || null,
            post.status,
            post.createdAt
              ? new Date(
                post.createdAt
              )
              : new Date(),
            publishedAt,
          ]
        );

        for (const pl of post.platforms) {
          const platformPostId =
            pl.platformPostId ||
            null;

          const zernioPostId =
            post.providerPostId ||
            null;

          const platformPostUrl =
            pl.platformPostUrl ||
            null;

          const pfStatus =
            pl.status ||
            post.status;

          const pfPublishedAt =
            pfStatus ===
              'published'
              ? new Date()
              : null;

          /*
           * Use existing platform row when possible.
           * This prevents creating duplicate rows
           * every time save() is called.
           */
          const existing =
            await client.query(
              `SELECT id
               FROM post_platforms
               WHERE post_id = $1
                 AND platform = $2
               LIMIT 1`,
              [
                post.internalPostId,
                pl.platform,
              ]
            );

          if (
            existing.rows.length > 0
          ) {
            await client.query(
              `UPDATE post_platforms
               SET
                 zernio_post_id = COALESCE($1, zernio_post_id),
                 platform_post_id = COALESCE($2, platform_post_id),
                 platform_post_url = COALESCE($3, platform_post_url),
                 status = $4,
                 published_at = $5
               WHERE id = $6`,
              [
                zernioPostId,
                platformPostId,
                platformPostUrl,
                pfStatus,
                pfPublishedAt,
                existing.rows[0].id,
              ]
            );
          } else {
            const platformRecordId =
              `pp_${uuidv4()}`;

            await client.query(
              `INSERT INTO post_platforms
               (
                 id,
                 post_id,
                 platform,
                 zernio_post_id,
                 platform_post_id,
                 platform_post_url,
                 status,
                 published_at
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
                 $8
               )`,
              [
                platformRecordId,
                post.internalPostId,
                pl.platform,
                zernioPostId,
                platformPostId,
                platformPostUrl,
                pfStatus,
                pfPublishedAt,
              ]
            );
          }
        }

        await client.query(
          'COMMIT'
        );
      } catch (err) {
        await client.query(
          'ROLLBACK'
        );

        console.error(
          '[PostRepository] DB save failed:',
          err
        );
      } finally {
        client.release();
      }
    }
  }

  public async findById(
    internalPostId: string
  ): Promise<
    PostRecord | undefined
  > {
    const pool = getDbPool();

    if (pool) {
      try {
        const postRes =
          await pool.query(
            'SELECT * FROM posts WHERE id = $1',
            [internalPostId]
          );

        if (
          postRes.rows.length > 0
        ) {
          const row =
            postRes.rows[0];

          const platformsRes =
            await pool.query(
              `SELECT *
               FROM post_platforms
               WHERE post_id = $1`,
              [internalPostId]
            );

          const platforms =
            platformsRes.rows.map(
              (pr: any) => ({
                platform:
                  pr.platform,

                status:
                  pr.status,

                platformPostId:
                  pr.platform_post_id ||
                  undefined,

                platformPostUrl:
                  pr.platform_post_url ||
                  undefined,
              })
            );

          const providerPostId =
            platformsRes.rows.find(
              (pr: any) =>
                pr.zernio_post_id
            )?.zernio_post_id ||
            undefined;

          return {
            internalPostId:
              row.id,

            providerPostId,

            idempotencyKey:
              row.idempotency_key,

            caption:
              row.caption ||
              undefined,

            imageUrl:
              row.media_url ||
              undefined,

            publishNow: true,

            status:
              row.status,

            platforms,

            createdAt:
              row.created_at
                ? new Date(
                  row.created_at
                ).toISOString()
                : new Date().toISOString(),

            updatedAt:
              row.updated_at
                ? new Date(
                  row.updated_at
                ).toISOString()
                : row.created_at
                  ? new Date(
                    row.created_at
                  ).toISOString()
                  : new Date().toISOString(),
          };
        }
      } catch (err) {
        console.error(
          '[PostRepository] DB findById failed, falling back to memory:',
          err
        );
      }
    }

    return this.posts.get(
      internalPostId
    );
  }

  public async findByIdempotencyKey(
    idempotencyKey: string
  ): Promise<
    PostRecord | undefined
  > {
    const pool = getDbPool();

    if (pool) {
      try {
        const postRes =
          await pool.query(
            `SELECT *
             FROM posts
             WHERE idempotency_key = $1`,
            [idempotencyKey]
          );

        if (
          postRes.rows.length > 0
        ) {
          return this.findById(
            postRes.rows[0].id
          );
        }
      } catch (err) {
        console.error(
          '[PostRepository] DB findByIdempotencyKey failed:',
          err
        );
      }
    }

    const internalPostId =
      this.idempotencyMap.get(
        idempotencyKey
      );

    if (internalPostId) {
      return this.posts.get(
        internalPostId
      );
    }

    return undefined;
  }

  public async resolveZernioPostId(
    postIdOrZernioId: string
  ): Promise<string> {
    const pool = getDbPool();

    if (pool) {
      try {
        /*
         * First try exact match against:
         * - internal post ID
         * - Zernio post ID
         * - platform post ID
         */
        const res =
          await pool.query(
            `SELECT
               zernio_post_id,
               platform_post_id
             FROM post_platforms
             WHERE
               post_id = $1
               OR zernio_post_id = $1
               OR platform_post_id = $1
             ORDER BY
               CASE
                 WHEN post_id = $1 THEN 1
                 WHEN zernio_post_id = $1 THEN 2
                 WHEN platform_post_id = $1 THEN 3
                 ELSE 4
               END
             LIMIT 1`,
            [postIdOrZernioId]
          );

        if (
          res.rows.length > 0
        ) {
          const row =
            res.rows[0];

          if (
            row.zernio_post_id
          ) {
            return String(
              row.zernio_post_id
            );
          }

          /*
           * If this ID itself is a platform ID
           * but there is no Zernio ID stored,
           * return the supplied ID as fallback.
           */
          if (
            row.platform_post_id
          ) {
            return String(
              row.platform_post_id
            );
          }
        }

        /*
         * If the supplied ID is an internal post ID,
         * search its platform rows explicitly.
         */
        const internalRes =
          await pool.query(
            `SELECT
               zernio_post_id,
               platform_post_id
             FROM post_platforms
             WHERE post_id = $1
             ORDER BY id
             LIMIT 1`,
            [postIdOrZernioId]
          );

        if (
          internalRes.rows.length >
          0
        ) {
          const row =
            internalRes.rows[0];

          if (
            row.zernio_post_id
          ) {
            return String(
              row.zernio_post_id
            );
          }

          if (
            row.platform_post_id
          ) {
            return String(
              row.platform_post_id
            );
          }
        }
      } catch (err) {
        console.error(
          '[PostRepository] DB resolveZernioPostId failed:',
          err
        );
      }
    }

    /*
     * In-memory fallback.
     */
    const post =
      this.posts.get(
        postIdOrZernioId
      );

    if (post) {
      if (
        post.providerPostId
      ) {
        return String(
          post.providerPostId
        );
      }

      if (
        Array.isArray(
          post.platforms
        )
      ) {
        const platformPost =
          post.platforms.find(
            (platform) =>
              platform.platformPostId
          );

        if (
          platformPost?.platformPostId
        ) {
          return String(
            platformPost.platformPostId
          );
        }
      }
    }

    /*
     * The supplied ID might already be
     * a Zernio/late/platform ID.
     */
    return postIdOrZernioId;
  }

  public async listAll(): Promise<
    PostRecord[]
  > {
    const pool = getDbPool();

    if (pool) {
      try {
        const postRes =
          await pool.query(
            `SELECT id
             FROM posts
             ORDER BY created_at DESC`
          );

        const results:
          PostRecord[] = [];

        for (const row of postRes.rows) {
          const rec =
            await this.findById(
              row.id
            );

          if (rec) {
            results.push(rec);
          }
        }

        if (
          results.length > 0
        ) {
          return results;
        }
      } catch (err) {
        console.error(
          '[PostRepository] DB listAll failed, falling back to memory:',
          err
        );
      }
    }

    return Array.from(
      this.posts.values()
    ).sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );
  }

  public async clear(): Promise<void> {
    this.posts.clear();
    this.idempotencyMap.clear();

    const pool = getDbPool();

    if (pool) {
      try {
        await pool.query(
          `TRUNCATE
             analytics_timeline,
             analytics_snapshots,
             post_platforms,
             posts,
             social_accounts
           CASCADE`
        );
      } catch (err) {
        console.error(
          '[PostRepository] DB clear failed:',
          err
        );
      }
    }
  }
}



// import { v4 as uuidv4 } from 'uuid';
// import { PostRecord } from '../types/publisher.types';
// import { getDbPool } from '../../db';

// export class PostRepositoryService {
//   private posts: Map<string, PostRecord> = new Map();
//   private idempotencyMap: Map<string, string> = new Map();

//   public async save(post: PostRecord): Promise<void> {
//     // 1. In-memory update
//     this.posts.set(post.internalPostId, post);
//     if (post.idempotencyKey) {
//       this.idempotencyMap.set(post.idempotencyKey, post.internalPostId);
//     }

//     // 2. Persistent PostgreSQL DB save if DB is configured
//     const pool = getDbPool();
//     if (pool) {
//       const client = await pool.connect();
//       try {
//         await client.query('BEGIN');

//         const publishedAt = post.status === 'published' ? new Date() : null;

//         await client.query(
//           `INSERT INTO posts (id, idempotency_key, caption, media_url, status, created_at, published_at)
//            VALUES ($1, $2, $3, $4, $5, $6, $7)
//            ON CONFLICT (id) DO UPDATE SET
//              status = EXCLUDED.status,
//              caption = EXCLUDED.caption,
//              media_url = EXCLUDED.media_url,
//              published_at = EXCLUDED.published_at`,
//           [
//             post.internalPostId,
//             post.idempotencyKey,
//             post.caption || null,
//             post.imageUrl || null,
//             post.status,
//             post.createdAt ? new Date(post.createdAt) : new Date(),
//             publishedAt,
//           ]
//         );

//         for (const pl of post.platforms) {
//           const platformPostId = pl.platformPostId || null;
//           const zernioPostId = post.providerPostId || null;
//           const platformPostUrl = pl.platformPostUrl || null;
//           const pfStatus = pl.status || post.status;
//           const pfPublishedAt = pfStatus === 'published' ? new Date() : null;
//           const platformRecordId = `pp_${uuidv4()}`;

//           await client.query(
//             `INSERT INTO post_platforms 
//              (id, post_id, platform, zernio_post_id, platform_post_id, platform_post_url, status, published_at)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
//             [
//               platformRecordId,
//               post.internalPostId,
//               pl.platform,
//               zernioPostId,
//               platformPostId,
//               platformPostUrl,
//               pfStatus,
//               pfPublishedAt,
//             ]
//           );
//         }

//         await client.query('COMMIT');
//       } catch (err) {
//         await client.query('ROLLBACK');
//         console.error('[PostRepository] DB save failed:', err);
//       } finally {
//         client.release();
//       }
//     }
//   }

//   public async findById(internalPostId: string): Promise<PostRecord | undefined> {
//     const pool = getDbPool();
//     if (pool) {
//       try {
//         const postRes = await pool.query('SELECT * FROM posts WHERE id = $1', [internalPostId]);
//         if (postRes.rows.length > 0) {
//           const row = postRes.rows[0];
//           const platformsRes = await pool.query('SELECT * FROM post_platforms WHERE post_id = $1', [internalPostId]);

//           const platforms = platformsRes.rows.map((pr) => ({
//             platform: pr.platform,
//             status: pr.status,
//             platformPostId: pr.platform_post_id || undefined,
//             platformPostUrl: pr.platform_post_url || undefined,
//           }));

//           const providerPostId = platformsRes.rows.find((pr) => pr.zernio_post_id)?.zernio_post_id || undefined;

//           return {
//             internalPostId: row.id,
//             providerPostId,
//             idempotencyKey: row.idempotency_key,
//             caption: row.caption || undefined,
//             imageUrl: row.media_url || undefined,
//             publishNow: true,
//             status: row.status,
//             platforms,
//             createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
//             updatedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
//           };
//         }
//       } catch (err) {
//         console.error('[PostRepository] DB findById failed, falling back to memory:', err);
//       }
//     }

//     return this.posts.get(internalPostId);
//   }

//   public async findByIdempotencyKey(idempotencyKey: string): Promise<PostRecord | undefined> {
//     const pool = getDbPool();
//     if (pool) {
//       try {
//         const postRes = await pool.query('SELECT * FROM posts WHERE idempotency_key = $1', [idempotencyKey]);
//         if (postRes.rows.length > 0) {
//           return this.findById(postRes.rows[0].id);
//         }
//       } catch (err) {
//         console.error('[PostRepository] DB findByIdempotencyKey failed:', err);
//       }
//     }

//     const internalPostId = this.idempotencyMap.get(idempotencyKey);
//     if (internalPostId) {
//       return this.posts.get(internalPostId);
//     }
//     return undefined;
//   }

//   public async resolveZernioPostId(postIdOrZernioId: string): Promise<string> {
//     // 1. Try DB mapping lookup
//     const pool = getDbPool();
//     if (pool) {
//       try {
//         const res = await pool.query(
//           `SELECT zernio_post_id FROM post_platforms 
//            WHERE post_id = $1 OR zernio_post_id = $1 OR platform_post_id = $1 
//            LIMIT 1`,
//           [postIdOrZernioId]
//         );
//         if (res.rows.length > 0 && res.rows[0].zernio_post_id) {
//           return res.rows[0].zernio_post_id;
//         }
//       } catch (err) {
//         console.error('[PostRepository] DB resolveZernioPostId failed:', err);
//       }
//     }

//     // 2. In-memory fallback
//     const post = this.posts.get(postIdOrZernioId);
//     if (post && post.providerPostId) {
//       return post.providerPostId;
//     }

//     return postIdOrZernioId;
//   }

//   public async listAll(): Promise<PostRecord[]> {
//     const pool = getDbPool();
//     if (pool) {
//       try {
//         const postRes = await pool.query('SELECT id FROM posts ORDER BY created_at DESC');
//         const results: PostRecord[] = [];
//         for (const row of postRes.rows) {
//           const rec = await this.findById(row.id);
//           if (rec) results.push(rec);
//         }
//         if (results.length > 0) return results;
//       } catch (err) {
//         console.error('[PostRepository] DB listAll failed, falling back to memory:', err);
//       }
//     }

//     return Array.from(this.posts.values()).sort(
//       (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//     );
//   }

//   public async clear(): Promise<void> {
//     this.posts.clear();
//     this.idempotencyMap.clear();

//     const pool = getDbPool();
//     if (pool) {
//       try {
//         await pool.query('TRUNCATE analytics_timeline, analytics_snapshots, post_platforms, posts, social_accounts CASCADE');
//       } catch (err) {
//         console.error('[PostRepository] DB clear failed:', err);
//       }
//     }
//   }
// }
