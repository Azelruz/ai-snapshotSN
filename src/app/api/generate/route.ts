import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

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

    const imageId = `img_${Math.random().toString(36).substring(2, 11)}`;
    const requestUrl = new URL(request.url);
    const hostUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const qrCodeUrl = `${hostUrl}/download/${imageId}`;

    // 3. บันทึกรูปต้นฉบับลง R2 ก่อน เพื่อนำลิงก์ไปส่งให้ Replicate
    let uploadedFaceUrl = "";
    if (faceImageBase64 && bucket) {
      try {
        const base64Data = faceImageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        
        const fileKey = `face_${imageId}.jpg`;
        await bucket.put(fileKey, buffer, {
          httpMetadata: { contentType: "image/jpeg" }
        });
        
        uploadedFaceUrl = `${hostUrl}/api/image/${fileKey}`;
        console.log(`[R2 Upload] Successfully uploaded face photo to R2: ${uploadedFaceUrl}`);
      } catch (uploadError) {
        console.error("[R2 Upload] Error uploading photo to R2:", uploadError);
      }
    }

    // รายการภาพต้นแบบของแต่ละธีมที่จะใช้สลับใบหน้าจริงเข้าไปใส่ (Target templates)
    const themeTemplates: Record<string, string> = {
      cyberpunk: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1024", 
      pixar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1024", 
      wedding: `${hostUrl}/templates/wedding_original.jpg`, // ใช้รูปแต่งงานจริงของคุณ
      anime: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1024", 
      luxury: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1024", 
    };

    const selectedTheme = themeName.toLowerCase();
    const targetImageUrl = themeTemplates[selectedTheme] || themeTemplates.cyberpunk;

    let predictionId = "";

    // 4. สั่งเริ่มประมวลผลรูปภาพบน Replicate API แบบด่วน (Edge API Request)
    if (replicateToken && uploadedFaceUrl) {
      try {
        if (selectedTheme === "wedding") {
          // --- ธีมแต่งงาน: ใช้โมเดลพิเศษที่สามารถเจาะจงใบหน้า (Face Swap with Indexes) ---
          // สลับใบหน้าของคุณลงเฉพาะ 'แขกผู้ชายเสื้อเชิ้ตสีขาวฝั่งซ้ายสุด' (Index 0) และปล่อยให้บ่าวสาวหน้าเดิม 100%
          console.log(`[AI Wedding Index Swap] Requesting Targeted Face Swap on Replicate...`);
          const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
              "Authorization": `Token ${replicateToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // mertguvencli/face-swap-with-indexes model version
              version: "518f2116425c40acb5c234031c55daf843c1357eff784370fe9489e57b65c150",
              input: {
                source_face_image: uploadedFaceUrl,    // หน้าของผู้ใช้งาน
                destination_image: targetImageUrl,     // รูปบ่าวสาวและแขกเสื้อขาว
                source_face_index: 0,
                destination_face_index: 0,              // ดัชนีหน้า 0 คือหน้าแขกที่อยู่ฝั่งซ้ายสุดของรูป
                execution_type: "face_swap"
              },
            }),
          });

          if (predictionResponse.ok) {
            const prediction = await predictionResponse.json() as { id: string };
            predictionId = prediction.id;
            console.log(`[AI Wedding Index Swap] Prediction created with ID: ${predictionId}`);
          } else {
            const errBody = await predictionResponse.text();
            console.error(`[AI Wedding Index Swap] Error: ${predictionResponse.status} - ${errBody}`);
          }
        } else {
          // --- ธีมอื่นๆ: ใช้การสลับหน้าตรงปกติ (Direct Face Swap) ---
          console.log(`[AI Replicate] Requesting face swap prediction creation on Replicate...`);
          const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
              "Authorization": `Token ${replicateToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
              input: {
                input_image: targetImageUrl,
                swap_image: uploadedFaceUrl,
              },
            }),
          });

          if (predictionResponse.ok) {
            const prediction = await predictionResponse.json() as { id: string };
            predictionId = prediction.id;
            console.log(`[AI Replicate] Face swap prediction created successfully with ID: ${predictionId}`);
          } else {
            const errBody = await predictionResponse.text();
            console.error(`[AI Replicate] Error creating prediction: ${predictionResponse.status} - ${errBody}`);
          }
        }
      } catch (err) {
        console.error(`[AI Replicate] Exception during prediction request:`, err);
      }
    }

    // 5. บันทึกข้อมูลลงฐานข้อมูล D1
    if (predictionId) {
      await db.insert(images).values({
        id: imageId,
        eventId: eventId,
        originalUrl: uploadedFaceUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500",
        generatedUrl: `replicate_pred_${predictionId}`,
        qrCode: qrCodeUrl,
        status: "pending",
        createdAt: new Date(),
      });
      console.log(`[D1 Database] Saved pending image ${imageId} referencing prediction ${predictionId}`);
    } else {
      // --- FALLBACK PATH: หากเรียก Replicate ไม่สำเร็จ ให้ใช้งานของฟรี Pollinations.ai ---
      console.log("[AI Fallback] No Replicate prediction created. Falling back to Pollinations.ai...");
      
      await db.insert(images).values({
        id: imageId,
        eventId: eventId,
        originalUrl: uploadedFaceUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500",
        generatedUrl: "",
        qrCode: qrCodeUrl,
        status: "pending",
        createdAt: new Date(),
      });

      const runPollinationsFallback = async () => {
        try {
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

          const aiResponse = await fetch(pollinationsUrl);
          if (aiResponse.ok) {
            await db.update(images)
              .set({
                generatedUrl: pollinationsUrl,
                status: "completed",
              })
              .where(eq(images.id, imageId));
            console.log(`[AI Fallback] Successfully set Pollinations fallback URL for ${imageId}`);
          } else {
            throw new Error(`Pollinations API returned status: ${aiResponse.status}`);
          }
        } catch (fallbackErr) {
          console.error(`[AI Fallback Exception] Error:`, fallbackErr);
          await db.update(images)
            .set({ status: "failed" })
            .where(eq(images.id, imageId))
            .catch(console.error);
        }
      };

      try {
        if (context && context.ctx && typeof context.ctx.waitUntil === "function") {
          context.ctx.waitUntil(runPollinationsFallback());
        } else {
          runPollinationsFallback();
        }
      } catch {
        runPollinationsFallback();
      }
    }

    // 6. ส่งตอบกลับด่วนให้เบราว์เซอร์รับงานไปประมวลผลต่อ
    return NextResponse.json({
      success: true,
      imageId,
      status: "pending",
      message: "AI process initialized",
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
