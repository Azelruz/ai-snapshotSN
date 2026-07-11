import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { templates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

// รูปแบบดีฟอลต์เริ่มต้นเพื่อสถาปนาเข้าตาราง D1 อัตโนมัติหากตารางยังว่างอยู่
const DEFAULT_TEMPLATES = [
  {
    id: "temp_wedding",
    name: "คู่บ่าวสาววิวาห์",
    imageUrl: "/templates/wedding_original.jpg",
    prompt: "Add the person in this photo (reference image 2) to join in expressing congratulations in the wedding photo (reference image 1), matching the style, lighting, and composition of the wedding photo perfectly, photorealistic, 8k resolution, shot on 85mm lens, masterpiece",
    aspectRatio: "3:2"
  },
  {
    id: "temp_cyberpunk",
    name: "เมืองไซเบอร์",
    imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600",
    prompt: "A high-quality photo. Generate a futuristic cyberpunk character based on the face and likeness of the person in the reference image. Glowing neon cybernetic implants, dark synthwave cityscape background, detailed skin texture, dramatic blue and pink volumetric lighting, shot on 85mm lens, f/1.8, photorealistic, masterpiece",
    aspectRatio: "1:1"
  },
  {
    id: "temp_pixar",
    name: "ห้องของเล่น",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600",
    prompt: "A high-quality 3D render. Generate a cute 3D animated character in classic Pixar Disney style based on the face and likeness of the person in the reference image. Soft warm studio lighting, highly detailed clay texture, vibrant friendly eyes, cheerful expression, masterpiece, clean background",
    aspectRatio: "1:1"
  },
  {
    id: "temp_anime",
    name: "แฟนตาซีญี่ปุ่น",
    imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600",
    prompt: "A high-quality anime key visual. Generate a beautiful anime character based on the face and likeness of the person in the reference image. Sharp lines, glowing detailed eyes, dramatic cinematic lighting, fantasy cherry blossom background, digital illustration, masterpiece",
    aspectRatio: "1:1"
  },
  {
    id: "temp_luxury",
    name: "แฟชั่นสตูดิโอ",
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600",
    prompt: "A high-quality fashion portrait. Generate a luxury fashion model based on the face and likeness of the person in the reference image. Elegant black and gold wardrobe, premium studio lighting, dark rich gold reflections, sophisticated mood, shot on Hasselblad, 8k resolution, cinematic, masterpiece",
    aspectRatio: "1:1"
  }
];

// GET: ดึงรายการรูปพื้นฐานทั้งหมด
export async function GET() {
  try {
    const db = getDb();
    let list = await db.select().from(templates).orderBy(desc(templates.createdAt));

    // หากตารางว่างเปล่า ให้ทำการสถาปนาดีฟอลต์เทมเพลตเข้าไปเป็นปฐมฤกษ์
    if (list.length === 0) {
      console.log("[Templates API] Database is empty. Seeding default templates...");
      const seedData = DEFAULT_TEMPLATES.map(t => ({
        ...t,
        createdAt: new Date()
      }));
      
      for (const item of seedData) {
        await db.insert(templates).values(item).onConflictDoNothing();
      }
      
      list = await db.select().from(templates).orderBy(desc(templates.createdAt));
    }

    return NextResponse.json({ success: true, templates: list });
  } catch (error: unknown) {
    console.error("Fetch templates error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: เพิ่มรูปพื้นฐานอันใหม่ (รองรับทั้งการอัปโหลดไฟล์ภาพจริงขึ้น R2 และการวาง URL ภาพภายนอก)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, prompt, aspectRatio = "1:1", imageUrl, imageFileBase64 } = body;

    if (!name || !prompt) {
      return NextResponse.json({ success: false, error: "Missing required fields (name, prompt)" }, { status: 400 });
    }

    const context = getCloudflareContext();
    const env = (context?.env as Record<string, unknown>) || {};
    const db = getDb();
    const bucket = env.BUCKET as unknown as R2Bucket;

    const templateId = `temp_${Math.random().toString(36).substring(2, 11)}`;
    const requestUrl = new URL(request.url);
    const hostUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    
    let finalImageUrl = imageUrl || "";

    // หากมีการส่งไฟล์ภาพเป็น Base64 เข้ามา ให้อัปโหลดขึ้น Cloudflare R2
    if (imageFileBase64 && bucket) {
      try {
        const base64Data = imageFileBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        
        const fileKey = `template_${templateId}.jpg`;
        await bucket.put(fileKey, buffer, {
          httpMetadata: { contentType: "image/jpeg" }
        });
        
        finalImageUrl = `${hostUrl}/api/image/${fileKey}`;
        console.log(`[R2 Upload] Uploaded base photo to R2: ${finalImageUrl}`);
      } catch (uploadError) {
        console.error("[R2 Upload] Error uploading base photo:", uploadError);
        return NextResponse.json({ success: false, error: "R2 Upload failed" }, { status: 500 });
      }
    }

    if (!finalImageUrl) {
      return NextResponse.json({ success: false, error: "Missing image (either imageUrl or imageFileBase64 is required)" }, { status: 400 });
    }

    // บันทึกลง D1
    await db.insert(templates).values({
      id: templateId,
      name,
      imageUrl: finalImageUrl,
      prompt,
      aspectRatio,
      createdAt: new Date()
    });

    return NextResponse.json({ success: true, message: "Template added successfully", templateId });

  } catch (error: unknown) {
    console.error("Create template error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE: ลบรูปพื้นฐานออกจากสารบบ
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing template ID parameter" }, { status: 400 });
    }

    const db = getDb();
    await db.delete(templates).where(eq(templates.id, id));

    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error: unknown) {
    console.error("Delete template error:", error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
