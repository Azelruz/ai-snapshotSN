import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Missing image ID parameter",
      }, { status: 400 });
    }

    const db = getDb();

    // 1. ดึงข้อมูลรูปภาพจาก D1
    const result = await db.select().from(images).where(eq(images.id, id)).limit(1);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Image not found",
      }, { status: 404 });
    }

    const imageRecord = result[0];

    // ดึง Token ความปลอดภัยจากคลาวด์
    const context = getCloudflareContext();
    const env = (context?.env as Record<string, unknown>) || {};
    const replicateToken = env.REPLICATE_API_TOKEN as string;

    // 2. หากยังอยู่ระหว่างการประมวลผล (pending)
    if (imageRecord.status === "pending") {
      
      // --- STAGE 1: เช็คสถานะการวาดตัวคนใหม่ทับแขกเดิม (Inpaint) ---
      if (imageRecord.generatedUrl?.startsWith("replicate_inpaint_") && replicateToken) {
        const inpaintPredId = imageRecord.generatedUrl.replace("replicate_inpaint_", "");
        
        try {
          console.log(`[Status API - Stage 1] Checking SDXL Inpaint status: ${inpaintPredId}`);
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${inpaintPredId}`, {
            headers: { "Authorization": `Token ${replicateToken}` },
          });

          if (pollResponse.ok) {
            const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
            const currentStatus = pollData.status;
            console.log(`[Status API - Stage 1] Inpaint prediction ${inpaintPredId} status: ${currentStatus}`);

            if (currentStatus === "succeeded" && pollData.output) {
              const inpaintedImageUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
              console.log(`[Status API - Stage 1] Inpaint succeeded. Image URL: ${inpaintedImageUrl}`);

              // --- ทริกเกอร์ต่อ STAGE 2: สั่งสลับใบหน้าจริง (Face Swap) ลงบนตัวละครที่ถูกวาดใหม่ ---
              console.log(`[Status API - Stage 2] Initializing Face Swap on top of inpainted body...`);
              const faceSwapResponse = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                  "Authorization": `Token ${replicateToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  version: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
                  input: {
                    input_image: inpaintedImageUrl,
                    swap_image: imageRecord.originalUrl,
                  },
                }),
              });

              if (faceSwapResponse.ok) {
                const swapPred = await faceSwapResponse.json() as { id: string };
                console.log(`[Status API - Stage 2] Face swap prediction created successfully with ID: ${swapPred.id}`);

                // อัปเดตรหัสของ Stage 2 ลง D1 เพื่อให้การสืบค้นครั้งถัดไปมาเช็คที่ Stage 2
                await db.update(images)
                  .set({
                    generatedUrl: `replicate_pred_${swapPred.id}`,
                  })
                  .where(eq(images.id, id));
              } else {
                const errText = await faceSwapResponse.text();
                throw new Error(`Failed to start face swap stage: ${errText}`);
              }
            } else if (currentStatus === "failed" || currentStatus === "canceled") {
              await db.update(images).set({ status: "failed" }).where(eq(images.id, id));
              imageRecord.status = "failed";
            }
          }
        } catch (inpaintError) {
          console.error(`[Status API - Stage 1 Exception] Error:`, inpaintError);
        }
      }

      // --- STAGE 2: เช็คสถานะการสลับใบหน้าจริง (Face Swap) ---
      else if (imageRecord.generatedUrl?.startsWith("replicate_pred_") && replicateToken) {
        const swapPredId = imageRecord.generatedUrl.replace("replicate_pred_", "");
        
        try {
          console.log(`[Status API - Stage 2] Checking Face Swap status: ${swapPredId}`);
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${swapPredId}`, {
            headers: { "Authorization": `Token ${replicateToken}` },
          });

          if (pollResponse.ok) {
            const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
            const currentStatus = pollData.status;
            console.log(`[Status API - Stage 2] Face swap prediction ${swapPredId} status: ${currentStatus}`);

            if (currentStatus === "succeeded" && pollData.output) {
              const finalImageUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
              
              // เสร็จสิ้นกระบวนการทั้งหมด อัปเดตสถานะเป็น completed
              await db.update(images)
                .set({
                  generatedUrl: finalImageUrl,
                  status: "completed",
                })
                .where(eq(images.id, id));
              
              console.log(`[Status API] Final face swap completed successfully for image ${id}`);
              imageRecord.status = "completed";
              imageRecord.generatedUrl = finalImageUrl;
            } else if (currentStatus === "failed" || currentStatus === "canceled") {
              await db.update(images).set({ status: "failed" }).where(eq(images.id, id));
              imageRecord.status = "failed";
            }
          }
        } catch (swapError) {
          console.error(`[Status API - Stage 2 Exception] Error:`, swapError);
        }
      }
    }

    // 3. ส่งข้อมูลสถานะปัจจุบันกลับไปแสดงผลหน้าจอ
    return NextResponse.json({
      success: true,
      status: imageRecord.status,
      imageUrl: (imageRecord.generatedUrl?.startsWith("replicate_inpaint_") || imageRecord.generatedUrl?.startsWith("replicate_pred_")) 
        ? "" 
        : imageRecord.generatedUrl,
      qrCode: imageRecord.qrCode,
      createdAt: imageRecord.createdAt,
    });

  } catch (error: unknown) {
    console.error("Status polling error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
