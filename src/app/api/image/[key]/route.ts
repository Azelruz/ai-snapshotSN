import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    if (!key) {
      return new Response("Missing file key", { status: 400 });
    }

    // ดึง R2 Bucket binding
    let bucket: R2Bucket | undefined;
    try {
      const context = getCloudflareContext();
      const env = context?.env as Record<string, unknown>;
      if (env?.BUCKET) {
        bucket = env.BUCKET as unknown as R2Bucket;
      }
    } catch {
      // Local dev fallback หรือกรณีไม่ได้รันบน Cloudflare
    }

    if (!bucket) {
      return new Response("R2 Bucket binding is not configured or available", { status: 500 });
    }

    // ดึงออบเจกต์จาก R2
    const object = await bucket.get(key);

    if (!object) {
      return new Response("Image not found in storage", { status: 404 });
    }

    // อ่านข้อมูลเป็น arrayBuffer
    const buffer = await object.arrayBuffer();

    // สร้าง Header เพื่อระบุประเภทข้อมูลรูปภาพ
    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
    headers.set("Content-Length", object.size.toString());
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(buffer, { headers });

  } catch (error: unknown) {
    console.error("Error serving R2 image:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
