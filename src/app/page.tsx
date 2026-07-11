"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const gold = "#D4AF37";
  const darkBg = "#0a0a0a";
  const surface = "#161616";
  const surfaceHover = "#1e1e1e";
  const textGray = "#999999";
  const borderColor = "rgba(212,175,55,0.15)";

  // UI States
  const [selectedTheme, setSelectedTheme] = useState("cyberpunk");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [imageId, setImageId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File Upload States
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [weddingTarget, setWeddingTarget] = useState<"groom" | "bride">("groom");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Themes Config
  const themes = [
    { id: "cyberpunk", name: "Cyberpunk", emoji: "🤖", desc: "แสงสีนีออนและไซเบอร์เนติกส์แห่งอนาคต" },
    { id: "pixar", name: "Pixar 3D", emoji: "🧸", desc: "ลายเส้นการ์ตูน 3 มิติแสนน่ารัก อบอุ่น" },
    { id: "wedding", name: "Royal Wedding", emoji: "👑", desc: "ธีมงานแต่งงานสุดหรูหราอลังการ" },
    { id: "anime", name: "Fantasy Anime", emoji: "✨", desc: "ลายเส้นการ์ตูนญี่ปุ่นแฟนตาซี" },
    { id: "luxury", name: "Luxury Gold", emoji: "⚜️", desc: "สไตล์โมเดลแฟชั่นโทนทอง-ดำพรีเมียม" },
  ];

  // Steps for loading simulation
  const loadingSteps = [
    "ตรวจจับองค์ประกอบใบหน้าและพื้นหลัง...",
    "สร้าง Prompts และส่งข้อมูลเข้าประมวลผลระบบ AI...",
    "แต่งเติมรายละเอียดขั้นสุดท้ายและเตรียมลิงก์รูปภาพ...",
  ];

  // Simulating loading steps progression while polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && currentStep < loadingSteps.length - 1) {
      interval = setInterval(() => {
        setCurrentStep((prev) => Math.min(prev + 1, loadingSteps.length - 1));
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [isGenerating, currentStep]);

  // Polling database status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && imageId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/status?id=${imageId}`);
          const data = await res.json();
          
          if (data.success) {
            setStatus(data.status);
            if (data.status === "completed" && data.imageUrl) {
              setResultUrl(data.imageUrl);
              setQrCodeUrl(data.qrCode);
              setIsGenerating(false);
              clearInterval(interval);
            } else if (data.status === "failed") {
              setErrorMsg("AI Generation failed. Please try again.");
              setIsGenerating(false);
              clearInterval(interval);
            }
          }
        } catch (e) {
          console.error("Error checking status:", e);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isGenerating, imageId]);

  // Triggering Generation
  const handleGenerate = async () => {
    setIsGenerating(true);
    setCurrentStep(0);
    setErrorMsg(null);
    setResultUrl(null);
    setQrCodeUrl(null);
    setStatus("pending");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeName: selectedTheme,
          promptText: "a high quality portrait photo of a guest",
          faceImageBase64: previewFile, // ส่งภาพใบหน้าที่ผู้ใช้อัปโหลดไปสลับรูปจริง
          weddingTarget: selectedTheme === "wedding" ? weddingTarget : undefined
        }),
      });
      const data = await response.json();

      if (data.success && data.imageId) {
        setImageId(data.imageId);
      } else {
        setErrorMsg(data.error || "Failed to start AI generation");
        setIsGenerating(false);
      }
    } catch (e) {
      setErrorMsg("Connection error. Could not reach server.");
      setIsGenerating(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: darkBg, color: "#ffffff", fontFamily: "system-ui, -apple-system, sans-serif",
      boxSizing: "border-box", margin: 0, padding: 0
    }}>
      {/* Header */}
      <header style={{
        padding: "20px 40px", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderBottom: `1px solid ${borderColor}`,
        background: "rgba(22, 22, 22, 0.8)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10
      }}>
        <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.04em" }}>
          AI<span style={{ color: gold }}>SNAP</span>
        </div>
        <div style={{
          background: "rgba(212,175,55,0.1)", border: `1px solid ${gold}`,
          color: gold, borderRadius: 50, padding: "6px 16px", fontSize: 13,
          fontWeight: 600, display: "flex", alignItems: "center", gap: 6
        }}>
          <span>●</span> D1 Cloud Connection Active
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        maxWidth: 1200, width: "100%", margin: "0 auto", padding: "40px 20px",
        boxSizing: "border-box"
      }}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            AI Photobooth <span style={{ color: gold }}>Playground</span>
          </h1>
          <p style={{ color: textGray, fontSize: 16, margin: 0 }}>
            ทดลองจำลองระบบถ่ายภาพ เลือกธีม AI และสั่งสร้างรูปภาพแบบประมวลผลเบื้องหลัง (Async)
          </p>
        </div>

        {/* Demo Core Grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 32, alignItems: "start"
        }}>
          {/* Left Column: Input Panel */}
          <div style={{
            background: surface, borderRadius: 28, padding: 32,
            border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 28
          }}>
            {/* Input 1: Take/Upload Photo */}
            <div>
              <label style={{ display: "block", fontSize: 15, fontWeight: 700, marginBottom: 12, color: gold }}>
                1. ถ่ายภาพหรืออัปโหลดรูปภาพใบหน้า
              </label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                style={{ display: "none" }} 
              />
              
              <div 
                onClick={triggerUpload}
                style={{
                  height: 200, border: `2px dashed ${borderColor}`, borderRadius: 20,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", background: "rgba(0,0,0,0.2)", overflow: "hidden",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.2)"}
              >
                {previewFile ? (
                  <img src={previewFile} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", padding: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>คลิกเพื่อจำลองการอัปโหลดรูปถ่าย</div>
                    <div style={{ fontSize: 12, color: textGray, marginTop: 4 }}>หรือระบบจะใช้รูปจำลองให้ทันที</div>
                  </div>
                )}
              </div>
            </div>

            {/* Input 2: Choose AI Theme */}
            <div>
              <label style={{ display: "block", fontSize: 15, fontWeight: 700, marginBottom: 12, color: gold }}>
                2. เลือกธีมภาพ AI สำหรับตู้ของคุณ
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {themes.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                      borderRadius: 16, background: selectedTheme === t.id ? "rgba(212,175,55,0.15)" : "rgba(0,0,0,0.15)",
                      border: `1px solid ${selectedTheme === t.id ? gold : "transparent"}`,
                      cursor: "pointer", transition: "all 0.2s"
                    }}
                    onMouseEnter={e => {
                      if (selectedTheme !== t.id) e.currentTarget.style.background = surfaceHover;
                    }}
                    onMouseLeave={e => {
                      if (selectedTheme !== t.id) e.currentTarget.style.background = "rgba(0,0,0,0.15)";
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{t.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: selectedTheme === t.id ? gold : "#fff" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: textGray }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedTheme === "wedding" && (
                <div style={{
                  marginTop: 15, padding: "16px 20px", borderRadius: 16,
                  background: "rgba(212,175,55,0.05)", border: `1px dashed ${borderColor}`,
                  display: "flex", flexDirection: "column", gap: 10
                }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: gold }}>
                    เลือกบทบาทที่จะสลับใบหน้าของคุณลงไป:
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => setWeddingTarget("groom")}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10,
                        background: weddingTarget === "groom" ? gold : "rgba(0,0,0,0.2)",
                        color: weddingTarget === "groom" ? darkBg : "#fff",
                        border: `1px solid ${weddingTarget === "groom" ? gold : borderColor}`,
                        fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      เจ้าบ่าว (Groom) 🤵
                    </button>
                    <button
                      onClick={() => setWeddingTarget("bride")}
                      style={{
                        flex: 1, padding: "10px 0", borderRadius: 10,
                        background: weddingTarget === "bride" ? gold : "rgba(0,0,0,0.2)",
                        color: weddingTarget === "bride" ? darkBg : "#fff",
                        border: `1px solid ${weddingTarget === "bride" ? gold : borderColor}`,
                        fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      เจ้าสาว (Bride) 👰
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                width: "100%", padding: "18px 0", borderRadius: 50, background: gold,
                color: darkBg, fontWeight: 800, fontSize: 16, border: "none",
                cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.6 : 1,
                boxShadow: `0 10px 30px rgba(212,175,55,0.25)`, transition: "transform 0.1s"
              }}
              onMouseDown={e => { if(!isGenerating) e.currentTarget.style.transform = "scale(0.98)" }}
              onMouseUp={e => { if(!isGenerating) e.currentTarget.style.transform = "scale(1)" }}
            >
              {isGenerating ? "ระบบ AI กำลังประมวลผล..." : "🚀 สั่งเจนรูป AI SNAP"}
            </button>
          </div>

          {/* Right Column: Preview Panel */}
          <div style={{
            background: surface, borderRadius: 28, padding: 32,
            border: `1px solid ${borderColor}`, minHeight: 450,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            position: "relative"
          }}>
            {isGenerating ? (
              /* Loading UI */
              <div style={{ textAlign: "center", padding: 20 }}>
                {/* Spinner */}
                <div style={{
                  width: 60, height: 60, border: `4px solid rgba(212,175,55,0.1)`,
                  borderTop: `4px solid ${gold}`, borderRadius: "50%",
                  margin: "0 auto 24px", animation: "spin 1s linear infinite"
                }} />
                <style jsx global>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: gold }}>
                  กำลังทำงานเบื้องหลัง (Async)
                </h3>
                <div style={{ fontSize: 14, color: "#fff", marginBottom: 6 }}>
                  {loadingSteps[currentStep]}
                </div>
                <div style={{ fontSize: 12, color: textGray }}>
                  ฐานข้อมูล D1 บันทึกสถานะ: <span style={{ color: "#FFB020", fontWeight: 600 }}>pending</span>
                </div>
              </div>
            ) : resultUrl ? (
              /* Completed Result UI */
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: gold }}>
                  ✨ ได้รับรูปภาพจาก AI แล้ว!
                </h3>
                
                {/* Main Image Container */}
                <div style={{
                  position: "relative", width: "100%", maxWidth: 380, borderRadius: 20,
                  overflow: "hidden", border: `1px solid ${borderColor}`,
                  boxShadow: "0 15px 40px rgba(0,0,0,0.5)"
                }}>
                  <img src={resultUrl} alt="AI Result" style={{ width: "100%", display: "block" }} />
                  
                  {/* Mock Frame Overlay (Luxury minimal border) */}
                  <div style={{
                    position: "absolute", top: 12, left: 12, right: 12, bottom: 12,
                    border: `1.5px solid rgba(212,175,55,0.5)`, pointerEvents: "none",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 12
                  }}>
                    <div style={{
                      color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: 2,
                      textShadow: "0 2px 4px rgba(0,0,0,0.8)", textAlign: "center"
                    }}>
                      AI SNAP · LAUNCH
                    </div>
                  </div>
                </div>

                {/* Meta details */}
                <div style={{
                  display: "flex", gap: 24, width: "100%", maxWidth: 380,
                  alignItems: "center", marginTop: 24, padding: "16px 20px",
                  background: "rgba(0,0,0,0.3)", borderRadius: 16, border: `1px solid ${borderColor}`
                }}>
                  {/* QR Code Container */}
                  <div style={{
                    background: "#fff", padding: 6, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {/* Generates a simple QR using dynamic QR API helper */}
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrCodeUrl || "")}`} 
                      alt="QR Code" 
                      style={{ width: 70, height: 70 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: gold }}>สแกน QR Code ดาวน์โหลด</div>
                    <div style={{ fontSize: 11, color: textGray, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
                      ID: {imageId}
                    </div>
                    <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600, marginTop: 2 }}>
                      สถานะ D1: completed
                    </div>
                  </div>
                </div>

                {/* Print button mock */}
                <button
                  onClick={() => alert(`ส่งรูป ${imageId} เข้าคิวพิมพ์ขนาด 4x6 สำเร็จ!`)}
                  style={{
                    marginTop: 20, width: "100%", maxWidth: 380, padding: "12px 0",
                    background: "transparent", color: "#fff", border: `1px solid ${gold}`,
                    borderRadius: 50, cursor: "pointer", fontWeight: 600, fontSize: 14,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,175,55,0.1)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
                >
                  🖨️ ทดสอบส่งคำสั่งพิมพ์รูป (Print Mock)
                </button>
              </div>
            ) : errorMsg ? (
              /* Error UI */
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 50, marginBottom: 16 }}>⚠️</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#EF4444" }}>
                  เกิดข้อผิดพลาด
                </h3>
                <p style={{ fontSize: 14, color: textGray, margin: 0 }}>{errorMsg}</p>
              </div>
            ) : (
              /* Idle state */
              <div style={{ textAlign: "center", padding: 20, color: textGray }}>
                <div style={{ fontSize: 60, marginBottom: 20 }}>🎭</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
                  หน้าจอพรีวิวผลลัพธ์
                </h3>
                <p style={{ fontSize: 14, maxWidth: 300, margin: 0, lineHeight: 1.6 }}>
                  หลังจากคุณกดสั่งงาน แผงฝั่งซ้ายจะบันทึกข้อมูลและแสดงภาพความละเอียดสูงที่เจนสดจาก AI ฝั่งขวาตรงนี้ครับ
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "30px 40px", textAlign: "center", fontSize: 13, color: textGray,
        borderTop: `1px solid ${borderColor}`, background: "rgba(22, 22, 22, 0.4)",
        boxSizing: "border-box"
      }}>
        © {new Date().getFullYear()} AI SNAP Platform · พัฒนาด้วยเทคโนโลยี Cloudflare Edge & D1 Database
      </footer>
    </div>
  );
}
