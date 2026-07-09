import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { images } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    // เชื่อมต่อ D1
    const db = getDb();

    // ดึงข้อมูลรูปภาพตาม ID
    const result = await db.select().from(images).where(eq(images.id, id)).limit(1);

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Image not found",
      }, { status: 404 });
    }

    const imageRecord = result[0];

    return NextResponse.json({
      success: true,
      status: imageRecord.status, // 'pending', 'completed', 'failed'
      imageUrl: imageRecord.generatedUrl,
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
