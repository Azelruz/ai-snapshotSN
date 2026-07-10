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

    // 2. หากยังอยู่ระหว่างการประมวลผล (pending) และมีข้อมูลอ้างอิงของ Replicate
    if (imageRecord.status === "pending" && imageRecord.generatedUrl?.startsWith("replicate_pred_")) {
      const predictionId = imageRecord.generatedUrl.replace("replicate_pred_", "");
      
      // ดึง Token ความปลอดภัยจากคลาวด์
      const context = getCloudflareContext();
      const env = (context?.env as Record<string, unknown>) || {};
      const replicateToken = env.REPLICATE_API_TOKEN as string;

      if (replicateToken) {
        try {
          console.log(`[Status API] Checking Replicate status for prediction: ${predictionId}`);
          
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
              "Authorization": `Token ${replicateToken}`,
            },
          });

          if (pollResponse.ok) {
            const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
            const currentStatus = pollData.status;

            console.log(`[Status API] Replicate prediction ${predictionId} status is: ${currentStatus}`);

            if (currentStatus === "succeeded" && pollData.output) {
              const finalOutputUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
              
              // ทำการบันทึก URL รูปสลับหน้าจริงลงฐานข้อมูล D1
              await db.update(images)
                .set({
                  generatedUrl: finalOutputUrl,
                  status: "completed",
                })
                .where(eq(images.id, id));
              
              console.log(`[Status API] D1 database updated: completed image ${id}`);
              
              // อัปเดตข้อมูลในตัวแปรสำหรับการส่งกลับ
              imageRecord.status = "completed";
              imageRecord.generatedUrl = finalOutputUrl;
            } else if (currentStatus === "failed" || currentStatus === "canceled") {
              // ทำการอัปเดตฐานข้อมูล D1 เป็นล้มเหลว
              await db.update(images)
                .set({
                  status: "failed",
                })
                .where(eq(images.id, id));
              
              console.log(`[Status API] D1 database updated: failed image ${id}`);
              imageRecord.status = "failed";
            }
          }
        } catch (apiError) {
          console.error(`[Status API Exception] Error contacting Replicate:`, apiError);
        }
      }
    }

    // 3. ส่งข้อมูลสถานะปัจจุบันกลับไปแสดงผลหน้าจอ
    return NextResponse.json({
      success: true,
      status: imageRecord.status, // 'pending', 'completed', 'failed'
      imageUrl: imageRecord.generatedUrl?.startsWith("replicate_pred_") ? "" : imageRecord.generatedUrl,
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
