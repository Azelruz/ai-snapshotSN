import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  // ใน Cloudflare Environment, binding DB จะเป็น D1Database object ที่ถูกฉีดเข้ามาใน process.env
  if (!process.env.DB) {
    throw new Error("Cloudflare D1 binding 'DB' is not configured or available.");
  }
  return drizzle(process.env.DB as any, { schema });
}
