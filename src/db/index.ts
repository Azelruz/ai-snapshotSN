import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

import { getCloudflareContext } from '@opennextjs/cloudflare';

export function getDb() {
  let d1: D1Database | undefined;

  // 1. ดึง D1 จาก Cloudflare Context (วิธีสำหรับ OpenNext บน Production)
  try {
    const context = getCloudflareContext();
    const env = context?.env as Record<string, unknown>;
    if (env?.DB) {
      d1 = env.DB as unknown as D1Database;
    }
  } catch {
    // ทำงานใน Local dev ที่ไม่มี Cloudflare context
  }

  // 2. ดึงจาก process.env (วิธีสำรองสำหรับ Local next dev)
  if (!d1 && process.env.DB) {
    d1 = process.env.DB as unknown as D1Database;
  }

  if (!d1) {
    throw new Error("Cloudflare D1 binding 'DB' is not configured or available.");
  }

  return drizzle(d1, { schema });
}
