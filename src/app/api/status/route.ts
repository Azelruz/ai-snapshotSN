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
    if (imageRecord.status === "pending" && replicateToken) {
      const generatedUrl = imageRecord.generatedUrl || "";

      // ==========================================
      // STAGE 1: เช็คสถานะการเจนพื้นหลังด้วย FLUX.1
      // ==========================================
      if (generatedUrl.startsWith("replicate_flux_")) {
        const fluxPredId = generatedUrl.replace("replicate_flux_", "");
        
        try {
          console.log(`[Status API - Stage 1] Polling FLUX.1 prediction: ${fluxPredId}`);
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${fluxPredId}`, {
            headers: { "Authorization": `Token ${replicateToken}` },
          });

          if (pollResponse.ok) {
            const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
            const currentStatus = pollData.status;
            console.log(`[Status API - Stage 1] FLUX.1 prediction ${fluxPredId} status: ${currentStatus}`);

            if (currentStatus === "succeeded" && pollData.output) {
              const fluxOutputUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
              console.log(`[Status API - Stage 1] FLUX.1 Succeeded. Output URL: ${fluxOutputUrl}`);

              // --- ทริกเกอร์ต่อ STAGE 2: สั่งสลับใบหน้าจริง (Face Swap) ลงบนตัวละครที่ FLUX เจนขึ้นมา ---
              console.log(`[Status API - Stage 2] Starting Face Swap...`);
              const faceSwapResponse = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                  "Authorization": `Token ${replicateToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  version: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
                  input: {
                    input_image: fluxOutputUrl,
                    swap_image: imageRecord.originalUrl,
                  },
                }),
              });

              if (faceSwapResponse.ok) {
                const swapPred = await faceSwapResponse.json() as { id: string };
                console.log(`[Status API - Stage 2] Face swap created successfully with ID: ${swapPred.id}`);

                // อัปเดต D1 ส่งต่อให้การเช็คคิวรอบถัดไปมาประมวลผลที่ Stage 2
                await db.update(images)
                  .set({
                    generatedUrl: `replicate_swap_${swapPred.id}`,
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
        } catch (fluxError) {
          console.error(`[Status API - Stage 1 Exception] Error:`, fluxError);
        }
      }

      // ==========================================
      // STAGE 2: เช็คสถานะการสลับใบหน้า (Face Swap)
      // ==========================================
      else if (generatedUrl.startsWith("replicate_swap_")) {
        const swapPredId = generatedUrl.replace("replicate_swap_", "");
        
        try {
          console.log(`[Status API - Stage 2] Polling Face Swap prediction: ${swapPredId}`);
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${swapPredId}`, {
            headers: { "Authorization": `Token ${replicateToken}` },
          });

          if (pollResponse.ok) {
            const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
            const currentStatus = pollData.status;
            console.log(`[Status API - Stage 2] Face swap prediction ${swapPredId} status: ${currentStatus}`);

            if (currentStatus === "succeeded" && pollData.output) {
              const swapOutputUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
              console.log(`[Status API - Stage 2] Face Swap Succeeded. Output URL: ${swapOutputUrl}`);

              // --- ทริกเกอร์ต่อ STAGE 3: ส่งแต่งหน้าให้คมชัดใสปิ๊งระดับ DSLR (GFPGAN Face Enhancer) ---
              console.log(`[Status API - Stage 3] Starting GFPGAN Face Restoration...`);
              const gfpganResponse = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                  "Authorization": `Token ${replicateToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  version: "0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c",
                  input: {
                    img: swapOutputUrl,
                    scale: 2,
                    version: "v1.4"
                  },
                }),
              });

              if (gfpganResponse.ok) {
                const gfpPred = await gfpganResponse.json() as { id: string };
                console.log(`[Status API - Stage 3] GFPGAN created successfully with ID: ${gfpPred.id}`);

                // อัปเดต D1 ส่งต่อให้การเช็คคิวรอบถัดไปมาประมวลผลที่ Stage 3
                await db.update(images)
                  .set({
                    generatedUrl: `replicate_gfp_${gfpPred.id}`,
                  })
                  .where(eq(images.id, id));
              } else {
                const errText = await gfpganResponse.text();
                throw new Error(`Failed to start GFPGAN enhancer stage: ${errText}`);
              }
            } else if (currentStatus === "failed" || currentStatus === "canceled") {
              await db.update(images).set({ status: "failed" }).where(eq(images.id, id));
              imageRecord.status = "failed";
            }
          }
        } catch (swapError) {
          console.error(`[Status API - Stage 2 Exception] Error:`, swapError);
        }
      }

      // ==============================================
      // STAGE 3: เช็คสถานะการแต่งหน้าชัด (GFPGAN Enhancer)
      // ==============================================
      else if (generatedUrl.startsWith("replicate_gfp_")) {
        const gfpPredId = generatedUrl.replace("replicate_gfp_", "");
        
        try {
          console.log(`[Status API - Stage 3] Polling GFPGAN prediction: ${gfpPredId}`);
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${gfpPredId}`, {
            headers: { "Authorization": `Token ${replicateToken}` },
          });

          if (pollResponse.ok) {
            const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
            const currentStatus = pollData.status;
            console.log(`[Status API - Stage 3] GFPGAN prediction ${gfpPredId} status: ${currentStatus}`);

            if (currentStatus === "succeeded" && pollData.output) {
              const finalImageUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
              console.log(`[Status API] GFPGAN Succeeded. Final enhanced image URL: ${finalImageUrl}`);

              // เสร็จสิ้นขั้นตอนทั้งหมด! อัปเดตสถานะฐานข้อมูลเป็น completed
              await db.update(images)
                .set({
                  generatedUrl: finalImageUrl,
                  status: "completed",
                })
                .where(eq(images.id, id));
              
              imageRecord.status = "completed";
              imageRecord.generatedUrl = finalImageUrl;
            } else if (currentStatus === "failed" || currentStatus === "canceled") {
              await db.update(images).set({ status: "failed" }).where(eq(images.id, id));
              imageRecord.status = "failed";
            }
          }
        } catch (gfpError) {
          console.error(`[Status API - Stage 3 Exception] Error:`, gfpError);
        }
      }
    }

    // 3. ส่งข้อมูลสถานะปัจจุบันกลับไปแสดงผลหน้าจอ
    const isTempPrefix = imageRecord.generatedUrl?.startsWith("replicate_flux_") || 
                         imageRecord.generatedUrl?.startsWith("replicate_swap_") || 
                         imageRecord.generatedUrl?.startsWith("replicate_gfp_");

    return NextResponse.json({
      success: true,
      status: imageRecord.status,
      imageUrl: isTempPrefix ? "" : imageRecord.generatedUrl,
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
