import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

// Helper to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { themeName = "Cyberpunk", promptText, faceImageBase64 } = body;

    // 1. ดึง Cloudflare Context และ Bindings
    const context = getCloudflareContext();
    const env = (context?.env as Record<string, unknown>) || {};
    const db = getDb();
    
    // ดึง R2 Bucket binding
    const bucket = env.BUCKET as unknown as R2Bucket;
    // ดึง Replicate Token จาก Environment Variables
    const replicateToken = env.REPLICATE_API_TOKEN as string;

    // 2. ป้องกัน Foreign Key Error: ตรวจสอบและสร้าง Mock User/Event หากยังไม่มีข้อมูลในระบบ
    let eventId = body.eventId;
    
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
    const requestUrl = new URL(request.url);
    const hostUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const qrCodeUrl = `${hostUrl}/download/${imageId}`;

    await db.insert(images).values({
      id: imageId,
      eventId: eventId,
      originalUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500", // Fallback URL
      generatedUrl: "",
      qrCode: qrCodeUrl,
      status: "pending",
      createdAt: new Date(),
    });

    // 4. บันทึกรูปต้นฉบับลง R2 (ถ้าส่งมาและ R2 พร้อมใช้งาน)
    let uploadedFaceUrl = "";
    if (faceImageBase64 && bucket) {
      try {
        // ลบ data URI prefix (เช่น data:image/jpeg;base64,) ออกเพื่อดึงเฉพาะข้อมูล Base64 จริง
        const base64Data = faceImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        
        const fileKey = `face_${imageId}.jpg`;
        await bucket.put(fileKey, buffer, {
          httpMetadata: { contentType: "image/jpeg" }
        });
        
        uploadedFaceUrl = `${hostUrl}/api/image/${fileKey}`;
        
        // อัปเดตลิงก์รูปภาพต้นฉบับใน D1
        await db.update(images)
          .set({ originalUrl: uploadedFaceUrl })
          .where(eq(images.id, imageId));
          
        console.log(`[R2 Upload] Successfully uploaded face photo to R2: ${uploadedFaceUrl}`);
      } catch (uploadError) {
        console.error("[R2 Upload] Error uploading photo to R2:", uploadError);
      }
    }

    // 5. เตรียมฟังก์ชันทำงานเบื้องหลัง (Background Task) สำหรับยิงสั่งงาน AI ของจริง
    const runBackgroundAi = async () => {
      try {
        // รายการภาพต้นแบบของแต่ละธีมที่จะใช้สลับใบหน้าจริงเข้าไปใส่ (Target templates)
        const themeTemplates: Record<string, string> = {
          cyberpunk: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1024", // Cyberpunk character style
          pixar: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1024", // 3D cartoon style
          wedding: "https://images.unsplash.com/photo-1519741497674-611481863552?w=1024", // Wedding suit/dress template
          anime: "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=1024", // Anime template style
          luxury: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1024", // Luxury model style
        };

        const selectedTheme = themeName.toLowerCase();
        const targetImageUrl = themeTemplates[selectedTheme] || themeTemplates.cyberpunk;

        // ตรวจสอบว่ามี Token และภาพใน R2 พร้อมใช้งานจริงหรือไม่
        if (replicateToken && uploadedFaceUrl) {
          console.log(`[AI Replicate] Starting real Face Swap using Replicate API...`);
          
          // เรียกใช้งาน Replicate API ในการสร้างการประมวลผล (Prediction)
          const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
              "Authorization": `Token ${replicateToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // lucataco/faceswap model version
              version: "9a423cef2b2dee94f4b64f3c0c5b7db5c3b52f5f190e29b4b45ccdc04b4c73e0",
              input: {
                target_image: targetImageUrl,
                swap_image: uploadedFaceUrl,
              },
            }),
          });

          if (!predictionResponse.ok) {
            const errBody = await predictionResponse.text();
            throw new Error(`Replicate API returned error: ${predictionResponse.status} - ${errBody}`);
          }

          const prediction = await predictionResponse.json() as { id: string; status: string; output?: string | string[] };
          const predictionId = prediction.id;
          let predictionStatus = prediction.status;
          let finalOutput: string | string[] | null = null;

          console.log(`[AI Replicate] Prediction created successfully with ID: ${predictionId}`);

          // ทำการสืบค้นสถานะ (Polling) จาก Replicate API เบื้องหลังจนกว่างานจะเสร็จ
          let attempts = 0;
          const maxAttempts = 30; // รอสูงสุด 30 วินาที
          
          while ((predictionStatus === "starting" || predictionStatus === "processing") && attempts < maxAttempts) {
            await delay(1000);
            attempts++;
            
            const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
              headers: { "Authorization": `Token ${replicateToken}` },
            });
            
            if (pollResponse.ok) {
              const pollData = await pollResponse.json();
              predictionStatus = pollData.status;
              if (predictionStatus === "succeeded") {
                finalOutput = pollData.output;
                break;
              } else if (predictionStatus === "failed") {
                throw new Error("Replicate face swap model processing failed");
              }
            }
          }

          if (predictionStatus === "succeeded" && finalOutput) {
            // อัปเดตตารางรูปใน D1 ด้วยภาพสลับใบหน้าจริงที่เสร็จสิ้น
            await db.update(images)
              .set({
                generatedUrl: Array.isArray(finalOutput) ? finalOutput[0] : (finalOutput || ""),
                status: "completed",
              })
              .where(eq(images.id, imageId));
              
            console.log(`[AI Replicate] Real Face Swap completed successfully for ${imageId}`);
          } else {
            throw new Error(`Replicate processing timeout or invalid status: ${predictionStatus}`);
          }

        } else {
          // --- FALLBACK MODE: ถ้าไม่มี API Token หรืออัปโหลดรูปไม่สำเร็จ ให้ถอยกลับไปใช้ของฟรี Pollinations.ai ---
          console.log("[AI Fallback] No Replicate Token or R2 configuration found. Using Pollinations.ai fallback.");
          await delay(4000);

          const themePrompts: Record<string, string> = {
            cyberpunk: "cyberpunk avatar style, futuristic neon lights, dark synthwave background, high tech cybernetics, digital art",
            pixar: "cute 3D animated character, pixar disney style, vibrant colors, soft lighting, friendly expression, high quality render",
            wedding: "royal wedding theme, elegant attire, soft warm lighting, luxury gold accents, floral background, classic portrait",
            anime: "modern anime key visual style, sharp lines, beautiful eyes, dramatic lighting, fantasy background",
            luxury: "luxury fashion model portrait, high-end studio lighting, elegant gold and black tones, premium feel",
          };

          const baseThemePrompt = themePrompts[selectedTheme] || themePrompts.cyberpunk;
          const finalPrompt = promptText 
            ? `${promptText}, ${baseThemePrompt}`
            : `portrait photo of a beautiful person, ${baseThemePrompt}, masterpiece, highly detailed, 8k resolution`;

          const randomSeed = Math.floor(Math.random() * 1000000);
          const pollinationsUrl = `https://image.pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${randomSeed}&nologo=true`;

          // เรียกทดลองดึงรูปให้เสร็จก่อนอัปเดตสถานะ
          const aiResponse = await fetch(pollinationsUrl);
          if (!aiResponse.ok) {
            throw new Error(`Pollinations AI generation failed with status: ${aiResponse.status}`);
          }

          await db.update(images)
            .set({
              generatedUrl: pollinationsUrl,
              status: "completed",
            })
            .where(eq(images.id, imageId));
            
          console.log(`[AI Fallback] Generated fallback image successfully for ${imageId}`);
        }

      } catch (bgError) {
        console.error(`[AI Background Exception] Error:`, bgError);
        
        await db.update(images)
          .set({ status: "failed" })
          .where(eq(images.id, imageId))
          .catch(console.error);
      }
    };

    // 6. สั่งรันเบื้องหลัง
    let hasWaitUntil = false;
    try {
      if (context && context.ctx && typeof context.ctx.waitUntil === "function") {
        context.ctx.waitUntil(runBackgroundAi());
        hasWaitUntil = true;
      }
    } catch {
      // Local next dev
    }

    if (!hasWaitUntil) {
      runBackgroundAi();
    }

    // 7. ส่งตอบกลับด่วน
    return NextResponse.json({
      success: true,
      imageId,
      status: "pending",
      message: "AI face swap process started in the background",
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
