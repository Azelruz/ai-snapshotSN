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

    // 2. หากยังอยู่ระหว่างการประมวลผล (pending) และมีรหัสงานของ Replicate
    if (imageRecord.status === "pending" && imageRecord.generatedUrl?.startsWith("replicate_pred_") && replicateToken) {
      const predId = imageRecord.generatedUrl.replace("replicate_pred_", "");
      
      try {
        console.log(`[Status API] Checking Replicate status for prediction: ${predId}`);
        const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
          headers: { "Authorization": `Token ${replicateToken}` },
        });

        if (pollResponse.ok) {
          const pollData = await pollResponse.json() as { status: string; output?: string | string[] };
          const currentStatus = pollData.status;
          console.log(`[Status API] Prediction ${predId} status is: ${currentStatus}`);

          if (currentStatus === "succeeded" && pollData.output) {
            const finalImageUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
            
            // อัปเดต D1 เป็น completed พร้อมเก็บผลลัพธ์ภาพสุดท้าย
            await db.update(images)
              .set({
                generatedUrl: finalImageUrl,
                status: "completed",
              })
              .where(eq(images.id, id));
            
            console.log(`[Status API] D1 updated: completed image ${id}`);
            imageRecord.status = "completed";
            imageRecord.generatedUrl = finalImageUrl;
          } else if (currentStatus === "failed" || currentStatus === "canceled") {
            await db.update(images).set({ status: "failed" }).where(eq(images.id, id));
            imageRecord.status = "failed";
          }
        }
      } catch (error) {
        console.error(`[Status API Exception] Error checking Replicate:`, error);
      }
    }

    // 3. ส่งข้อมูลสถานะปัจจุบันกลับไปแสดงผลหน้าจอ
    return NextResponse.json({
      success: true,
      status: imageRecord.status,
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
