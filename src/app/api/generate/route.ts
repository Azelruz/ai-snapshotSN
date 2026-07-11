import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Bucket } from "@cloudflare/workers-types";

// ฟังก์ชันสำหรับเลือกและประมวลผลคำสั่งระบบตามแต่ละธีมและประยุกต์ใช้ Reference Image ของผู้ใช้
function getThemePrompt(theme: string, userText: string): string {
  const themeDetails: Record<string, string> = {
    cyberpunk: "A high-quality photo. Generate a futuristic cyberpunk character based on the face and likeness of the person in the reference image. Glowing neon cybernetic implants, dark synthwave cityscape background, detailed skin texture, dramatic blue and pink volumetric lighting, shot on 85mm lens, f/1.8, photorealistic, masterpiece",
    pixar: "A high-quality 3D render. Generate a cute 3D animated character in classic Pixar Disney style based on the face and likeness of the person in the reference image. Soft warm studio lighting, highly detailed clay texture, vibrant friendly eyes, cheerful expression, masterpiece, clean background",
    luxury: "A high-quality fashion portrait. Generate a luxury fashion model based on the face and likeness of the person in the reference image. Elegant black and gold wardrobe, premium studio lighting, dark rich gold reflections, sophisticated mood, shot on Hasselblad, 8k resolution, cinematic, masterpiece",
    anime: "A high-quality anime key visual. Generate a beautiful anime character based on the face and likeness of the person in the reference image. Sharp lines, glowing detailed eyes, dramatic cinematic lighting, fantasy cherry blossom background, digital illustration, masterpiece",
    wedding: "Add the person in this photo (reference image 2) to join in expressing congratulations in the wedding photo (reference image 1), matching the style, lighting, and composition of the wedding photo perfectly, photorealistic, 8k resolution, shot on 85mm lens, masterpiece"
  };

  const baseDetail = themeDetails[theme] || themeDetails.cyberpunk;
  if (userText && userText.trim().length > 0) {
    return `${userText}, ${baseDetail}`;
  }
  return baseDetail;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { themeName = "Cyberpunk", promptText = "", faceImageBase64, basePhotoUrl } = body;

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

    // 3. บันทึกรูปต้นฉบับลง R2 (ถ้ามีการอัปโหลดรูปภาพใบหน้าเข้ามา)
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

    // 4. เรียกใช้งานโมเดล gpt-image-2 บน Replicate เพื่อสร้างภาพ (ไม่มี Face Swap)
    if (replicateToken) {
      try {
        const finalPrompt = getThemePrompt(selectedTheme, promptText);
        
        // กำหนดอาร์เรย์รูปภาพอ้างอิง (input_images)
        const inputImages: string[] = [];
        let reqAspectRatio = "1:1";

        // กำหนดรูปพื้นหลังเริ่มต้น (ดีฟอลต์เป็นรูปแต่งงานหากไม่ได้ระบุมา)
        let resolvedBaseUrl = basePhotoUrl || `${hostUrl}/templates/wedding_original.jpg`;
        if (resolvedBaseUrl.startsWith("/")) {
          resolvedBaseUrl = `${hostUrl}${resolvedBaseUrl}`;
        }
        
        inputImages.push(resolvedBaseUrl);

        // ดึงรูปหน้าแขกที่อัปโหลด (ถ้ามี) เป็นรูปอ้างอิงใบหน้าที่สอง
        if (uploadedFaceUrl) {
          inputImages.push(uploadedFaceUrl);
        }

        // หากรูปพื้นหลังหลักเป็นรูปแต่งงาน กำหนดสัดส่วน 3:2 นอกนั้น 1:1
        if (resolvedBaseUrl.includes("wedding")) {
          reqAspectRatio = "3:2";
        }

        console.log(`[AI GPT Image 2] Generating image for theme ${selectedTheme}`);
        console.log(`[AI GPT Image 2] Prompt: "${finalPrompt}"`);
        console.log(`[AI GPT Image 2] Reference Images:`, inputImages);

        const predictionResponse = await fetch("https://api.replicate.com/v1/models/openai/gpt-image-2/predictions", {
          method: "POST",
          headers: {
            "Authorization": `Token ${replicateToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: {
              prompt: finalPrompt,
              aspect_ratio: reqAspectRatio,
              num_outputs: 1,
              ...(inputImages.length > 0 ? { input_images: inputImages } : {})
            },
          }),
        });

        if (predictionResponse.ok) {
          const prediction = await predictionResponse.json() as { id: string };
          predictionId = prediction.id;
          console.log(`[AI GPT Image 2] Prediction created successfully with ID: ${predictionId}`);
        } else {
          const errBody = await predictionResponse.text();
          console.error(`[AI GPT Image 2] Error creating prediction: ${predictionResponse.status} - ${errBody}`);
        }
      } catch (err) {
        console.error(`[AI Replicate] Exception during prediction request:`, err);
      }
    }

    // 5. บันทึกข้อมูลลง D1
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
      console.log(`[D1 Database] Saved pending image ${imageId} referencing prediction replicate_pred_${predictionId}`);
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
          const finalPrompt = getThemePrompt(selectedTheme, promptText);
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
