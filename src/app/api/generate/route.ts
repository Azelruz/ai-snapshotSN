import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

// ฟังก์ชันจำลอง LLM ขยาย Prompt ให้ละเอียดและสวยงาม (Prompt Expansion)
function expandPrompt(theme: string, userText: string): string {
  const themeDetails: Record<string, string> = {
    cyberpunk: "cinematic film still of a futuristic cyberpunk character, glowing neon cybernetic implants, dark synthwave cityscape background, detailed skin texture, dramatic blue and pink volumetric lighting, shot on 85mm lens, f/1.8, award-winning digital art, photorealistic",
    pixar: "adorable 3D animated character in classic Pixar Disney style, soft warm studio lighting, highly detailed clay texture, vibrant friendly eyes, cheerful expression, 3D render, masterpiece, octane render, clean background",
    luxury: "high-fashion editorial portrait, luxury fashion model, elegant black and gold wardrobe, premium studio lighting, dark rich gold reflections, sophisticated mood, shot on Hasselblad, 8k resolution, cinematic, masterpiece",
    anime: "modern anime key visual, beautiful anime character, sharp lines, glowing detailed eyes, dramatic cinematic lighting, fantasy cherry blossom background, digital illustration, masterpiece, high quality"
  };

  const baseDetail = themeDetails[theme] || themeDetails.cyberpunk;
  if (userText && userText.trim().length > 0) {
    return `${userText}, styled as ${baseDetail}`;
  }
  return `a stunning professional portrait of a person, ${baseDetail}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { themeName = "Cyberpunk", promptText = "", faceImageBase64 } = body;

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

    const selectedTheme = themeName.toLowerCase();
    let predictionId = "";
    let startPrefix = ""; // ระบุสถานะเริ่มต้นของ D1

    // 4. สั่งเริ่มประมวลผลรูปภาพบน Replicate API
    if (replicateToken && uploadedFaceUrl) {
      try {
        if (selectedTheme === "wedding") {
          // --- ธีมแต่งงาน: ข้าม Stage 1 เจนพื้นหลัง -> ไปรัน Stage 2 (Face Swap with Indexes) บนรูปจริงทันที ---
          console.log(`[AI Wedding Index Swap] Requesting Targeted Face Swap on Replicate...`);
          const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
              "Authorization": `Token ${replicateToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version: "518f2116425c40acb5c234031c55daf843c1357eff784370fe9489e57b65c150",
              input: {
                source_face_image: uploadedFaceUrl,
                destination_image: `${hostUrl}/templates/wedding_original.jpg`,
                source_face_index: 0,
                destination_face_index: 0,
                execution_type: "face_swap"
              },
            }),
          });

          if (predictionResponse.ok) {
            const prediction = await predictionResponse.json() as { id: string };
            predictionId = prediction.id;
            startPrefix = "replicate_swap_"; // ส่งไม้ต่อเพื่อไปตรวจและส่งต่อให้ตาสอง (GFPGAN)
            console.log(`[AI Wedding Index Swap] Prediction created with ID: ${predictionId}`);
          } else {
            const errBody = await predictionResponse.text();
            console.error(`[AI Wedding Index Swap] Error: ${predictionResponse.status} - ${errBody}`);
          }
        } else {
          // --- ธีมทั่วไป: รัน Stage 1 (FLUX.1 Schnell) เพื่อเจนพื้นหลังคนใหม่ที่คมชัด สวยงาม ---
          const detailedPrompt = expandPrompt(selectedTheme, promptText);
          console.log(`[AI FLUX.1] Creating backdrop image with prompt: "${detailedPrompt}"`);
          
          const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
              "Authorization": `Token ${replicateToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // black-forest-labs/flux-schnell model version
              version: "f20dfaa77e6d9275e192c0211516e917dcb6546376abd2e088191295325881cf",
              input: {
                prompt: detailedPrompt,
                aspect_ratio: "1:1",
                num_outputs: 1,
                output_format: "jpg"
              },
            }),
          });

          if (predictionResponse.ok) {
            const prediction = await predictionResponse.json() as { id: string };
            predictionId = prediction.id;
            startPrefix = "replicate_flux_"; // ส่งไม้ต่อเข้ารันสเตจ FLUX ก่อน
            console.log(`[AI FLUX.1] Prediction created successfully with ID: ${predictionId}`);
          } else {
            const errBody = await predictionResponse.text();
            console.error(`[AI FLUX.1] Error creating prediction: ${predictionResponse.status} - ${errBody}`);
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
        generatedUrl: `${startPrefix}${predictionId}`,
        qrCode: qrCodeUrl,
        status: "pending",
        createdAt: new Date(),
      });
      console.log(`[D1 Database] Saved pending image ${imageId} referencing prediction ${startPrefix}${predictionId}`);
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
          const finalPrompt = expandPrompt(selectedTheme, promptText);
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
