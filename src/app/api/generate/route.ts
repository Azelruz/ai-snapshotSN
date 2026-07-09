import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Helper to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { themeName = "Cyberpunk", promptText } = body;

    // 1. เชื่อมต่อฐานข้อมูล D1
    const db = getDb();

    // 2. ป้องกัน Foreign Key Error: ตรวจสอบและสร้าง Mock User/Event หากยังไม่มีข้อมูลในระบบ
    let eventId = body.eventId;
    
    // ค้นหายูสเซอร์แรกในระบบ หรือสร้างขึ้นมาใหม่หากไม่มี
    const userList = await db.select().from(users).limit(1);
    let userId = userList[0]?.id;
    if (!userId) {
      userId = "mock-user-id";
      await db.insert(users).values({
        id: userId,
        name: "Test User",
        email: "test@aisnap.local",
      }).onConflictDoNothing();
    }

    // ตรวจสอบ Event ID ถ้าส่งมา หรือถ้าไม่ได้ส่งมาให้ค้นหาอันแรก หรือสร้างขึ้นมาใหม่
    if (eventId) {
      const existingEvent = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (existingEvent.length === 0) {
        eventId = null;
      }
    }

    if (!eventId) {
      const eventList = await db.select().from(events).limit(1);
      if (eventList.length > 0) {
        eventId = eventList[0].id;
      } else {
        eventId = "mock-event-id";
        await db.insert(events).values({
          id: eventId,
          userId: userId,
          name: "Test Launch Event",
          createdAt: new Date(),
        }).onConflictDoNothing();
      }
    }

    // 3. กำหนดข้อมูลตั้งต้นและสร้าง Record สถานะ 'pending' ใน D1
    const imageId = `img_${Math.random().toString(36).substring(2, 11)}`;
    const qrCodeUrl = `https://ai-snapshot.narapong-an.workers.dev/download/${imageId}`;

    await db.insert(images).values({
      id: imageId,
      eventId: eventId,
      originalUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500", // รูปจำลอง
      generatedUrl: "", // ยังไม่มีรูปเพราะรอ AI เจนเบื้องหลัง
      qrCode: qrCodeUrl,
      status: "pending",
      createdAt: new Date(),
    });

    // 4. เตรียมฟังก์ชันทำงานเบื้องหลัง (Background Task)
    const runBackgroundAi = async () => {
      try {
        // หน่วงเวลาจำลองการทำงานของ AI จริง 5 วินาที เพื่อให้หน้าบ้านเห็น Loading States
        await delay(5000);

        // คำนวณ Prompt สำหรับ Pollinations.ai
        const themePrompts: Record<string, string> = {
          cyberpunk: "cyberpunk avatar style, futuristic neon lights, dark synthwave background, high tech cybernetics, digital art",
          pixar: "cute 3D animated character, pixar disney style, vibrant colors, soft lighting, friendly expression, high quality render",
          wedding: "royal wedding theme, elegant attire, soft warm lighting, luxury gold accents, floral background, classic portrait",
          anime: "modern anime key visual style, sharp lines, beautiful eyes, dramatic lighting, fantasy background",
          luxury: "luxury fashion model portrait, high-end studio lighting, elegant gold and black tones, premium feel",
        };

        const selectedTheme = themeName.toLowerCase();
        const baseThemePrompt = themePrompts[selectedTheme] || themePrompts.cyberpunk;
        const finalPrompt = promptText 
          ? `${promptText}, ${baseThemePrompt}`
          : `portrait photo of a beautiful person, ${baseThemePrompt}, masterpiece, highly detailed, 8k resolution`;

        const randomSeed = Math.floor(Math.random() * 1000000);
        const pollinationsUrl = `https://image.pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${randomSeed}&nologo=true`;

        // สั่งดึงไฟล์รูปภาพใน Background Worker ก่อน เพื่อรอให้ AI เจนเสร็จและแคชไว้บน CDN
        const aiResponse = await fetch(pollinationsUrl);
        if (!aiResponse.ok) {
          throw new Error(`Pollinations AI generation failed with status: ${aiResponse.status}`);
        }

        // ทำการอัปเดตรูปภาพที่สร้างเสร็จแล้วและปรับสถานะเป็น 'completed'
        await db.update(images)
          .set({
            generatedUrl: pollinationsUrl,
            status: "completed",
          })
          .where(eq(images.id, imageId));

        console.log(`[AI Background] Successfully generated image ${imageId}`);
      } catch (bgError) {
        console.error(`[AI Background] Error generating image ${imageId}:`, bgError);
        
        // ถ้าเกิดข้อผิดพลาดเบื้องหลัง ให้บันทึกสถานะเป็น 'failed'
        await db.update(images)
          .set({ status: "failed" })
          .where(eq(images.id, imageId))
          .catch(console.error);
      }
    };

    // 5. สั่งรันคำสั่งเบื้องหลังโดยใช้ ctx.waitUntil ของ Cloudflare (ถ้าไม่มีให้รันลอยๆ ใน Local)
    let hasWaitUntil = false;
    try {
      const context = getCloudflareContext();
      if (context && context.ctx && typeof context.ctx.waitUntil === "function") {
        context.ctx.waitUntil(runBackgroundAi());
        hasWaitUntil = true;
      }
    } catch {
      // ไม่ได้รันอยู่บน Cloudflare (เช่น next dev ใน local)
    }

    if (!hasWaitUntil) {
      // รันลอยๆ ใน Node.js (จะไม่มีปัญหาการตัดจบกลางทางใน local dev)
      runBackgroundAi();
    }

    // 6. ตอบกลับผู้ใช้ทันที (Response Time รวดเร็วมาก!)
    return NextResponse.json({
      success: true,
      imageId,
      status: "pending",
      message: "AI image generation started in the background",
    });

  } catch (error: unknown) {
    console.error("Generate start error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
