import { createApp } from './app';
import { config, validateConfig } from './config/env';

try {
  validateConfig();
} catch (err: any) {
  console.warn('[Warning]', err.message);
}

const app = createApp();

app.listen(config.port, () => {
  console.log(`🚀 Social Publishing Agent server listening on http://localhost:${config.port}`);
  console.log(`📡 Base Zernio URL: ${config.zernioBaseUrl}`);
  const key = config.zernioApiKey;
  console.log(`🔑 ZERNIO_API_KEY exists: ${!!key}, length: ${key ? key.length : 0}, startsWithSk: ${key ? key.startsWith('sk_') : false}`);
});
