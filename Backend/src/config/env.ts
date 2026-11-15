import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  zernioApiKey: string;
  zernioBaseUrl: string;
}

export const config: AppConfig = {
  get port() {
    return parseInt(process.env.PORT || '3000', 10);
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get zernioApiKey() {
    return process.env.ZERNIO_API_KEY || '';
  },
  get zernioBaseUrl() {
    return process.env.ZERNIO_BASE_URL || 'https://zernio.com/api/v1';
  },
};

export function validateConfig(): void {
  if (!config.zernioBaseUrl) {
    throw new Error('ZERNIO_BASE_URL environment variable is required.');
  }
}

