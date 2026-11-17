import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: Number(config.get('REDIS_PORT', 6380)),
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  }

  async connect() {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async get(key: string) {
    await this.connect();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.connect();
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string) {
    await this.connect();
    await this.client.del(key);
  }

  async delByPattern(pattern: string) {
    await this.connect();
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (resultKeys: string[]) => {
        keys.push(...resultKeys);
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    if (keys.length) await this.client.del(...keys);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
