import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { themeName = "Cyberpunk", promptText } = body;

    // 1. เชื่อมต่อฐานข้อมูล D1
    const db = getDb();

    // 2. ป้องกัน Foreign Key Error: ตรวจสอบและสร้าง Mock User/Event หากยังไม่มีข้อมูลในระบบ
    let eventId = body.eventId;
    
    // ค้นหายูสเซอร์แรกในระบบ หรือสร้างขึ้นมาใหม่หากไม่มี
    let userList = await db.select().from(users).limit(1);
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
        eventId = null; // ถ้าไอดีไม่มีอยู่จริง ให้หาตัวอื่น
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

    // 3. กำหนด Prompt สำหรับการส่งหา AI (Pollinations.ai)
    // ธีมต่างๆ ที่ผู้ใช้สามารถเลือกได้
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

    // 4. สร้าง Image URL ของ Pollinations.ai
    // Pollinations.ai สามารถใช้ URL ตรงในการดึงรูปภาพที่เพิ่งเจนขึ้นมาใหม่ได้เลย
    const randomSeed = Math.floor(Math.random() * 1000000);
    const pollinationsUrl = `https://image.pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${randomSeed}&nologo=true`;

    // 5. บันทึกประวัติรูปลงฐานข้อมูล D1
    const imageId = `img_${Math.random().toString(36).substring(2, 11)}`;
    const qrCodeUrl = `https://ai-snapshotsn.pages.dev/download/${imageId}`;

    await db.insert(images).values({
      id: imageId,
      eventId: eventId,
      originalUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500", // รูป Mock ต้นฉบับ
      generatedUrl: pollinationsUrl,
      qrCode: qrCodeUrl,
      status: "completed",
      createdAt: new Date(),
    });

    // 6. ส่งผลลัพธ์กลับไปให้หน้าบ้านใช้งาน
    return NextResponse.json({
      success: true,
      imageId,
      imageUrl: pollinationsUrl,
      qrCode: qrCodeUrl,
      prompt: finalPrompt,
    });

  } catch (error: any) {
    console.error("Generate error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Something went wrong during generation",
    }, { status: 500 });
  }
}
