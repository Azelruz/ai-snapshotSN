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
  const [selectedBasePhoto, setSelectedBasePhoto] = useState("/templates/wedding_original.jpg");
  const [selectedTheme, setSelectedTheme] = useState("wedding");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [imageId, setImageId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File Upload States
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface BasePhoto {
    id: string;
    name: string;
    imageUrl: string;
    prompt?: string;
    aspectRatio?: string;
  }

  // Base Photos Config (Default Hardcoded Fallbacks)
  const defaultBasePhotos: BasePhoto[] = [
    { id: "temp_wedding", name: "คู่บ่าวสาววิวาห์", imageUrl: "/templates/wedding_original.jpg" },
    { id: "temp_cyberpunk", name: "เมืองไซเบอร์", imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600" },
    { id: "temp_pixar", name: "ห้องของเล่น", imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600" },
    { id: "temp_anime", name: "แฟนตาซีญี่ปุ่น", imageUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600" },
    { id: "temp_luxury", name: "แฟชั่นสตูดิโอ", imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600" }
  ];
  const [basePhotos, setBasePhotos] = useState<BasePhoto[]>(defaultBasePhotos);

  // Fetch templates dynamically from backend
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        if (data.success && data.templates.length > 0) {
          setBasePhotos(data.templates);
          // Set default base photo to the first item from D1
          setSelectedBasePhoto(data.templates[0].imageUrl);
        }
      } catch (err) {
        console.error("Error loading templates from D1:", err);
      }
    };
    loadTemplates();
  }, []);

  // Themes Config
  const themes = [
    { id: "wedding", name: "Royal Wedding", emoji: "👑", desc: "สไตล์งานวิวาห์ร่วมยินดีสุดคลาสสิก" },
    { id: "cyberpunk", name: "Cyberpunk", emoji: "🤖", desc: "แสงสีนีออนและเทคโนโลยีไซเบอร์อนาคต" },
    { id: "pixar", name: "Pixar 3D", emoji: "🧸", desc: "ลายเส้นการ์ตูน 3 มิติแสนน่ารัก อบอุ่น" },
    { id: "anime", name: "Fantasy Anime", emoji: "✨", desc: "ลายเส้นการ์ตูนญี่ปุ่นสุดอลังการ" },
    { id: "luxury", name: "Luxury Gold", emoji: "⚜️", desc: "สไตล์แฟชั่นหรูหรา โทนทอง-ดำพรีเมียม" },
  ];

  // Steps for loading simulation
  const loadingSteps = [
    "รับภาพพื้นฐานและประมวลผล R2 Storage...",
    "ขยาย Prompts และเรียบเรียงโครงสร้างส่งต่อ Replicate...",
    "ประมวลผลโมเดลเรือธง gpt-image-2 เพื่อสร้างสรรค์ภาพใหม่...",
  ];

  // Simulating loading steps progression while polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && currentStep < loadingSteps.length - 1) {
      interval = setInterval(() => {
        setCurrentStep((prev) => Math.min(prev + 1, loadingSteps.length - 1));
      }, 2500);
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
          faceImageBase64: previewFile,
          basePhotoUrl: selectedBasePhoto
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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.04em" }}>
            AI<span style={{ color: gold }}>SNAP</span>
          </div>
          <a 
            href="/admin" 
            style={{
              background: "rgba(212,175,55,0.1)", border: `1px solid ${gold}`,
              color: gold, borderRadius: 8, padding: "6px 14px", fontSize: 12,
              fontWeight: 700, textDecoration: "none", transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(212,175,55,0.1)"}
          >
            ⚙️ จัดการรูปพื้นฐาน & Prompts
          </a>
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
            จำลองกระบวนการสร้างสรรค์รูปภาพด้วยโมเดลเรือธงของ OpenAI (gpt-image-2) แบบเรียลไทม์
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
            
            {/* ขั้นตอนที่ 1: เลือกรูปพื้นฐาน */}
            <div>
              <label style={{ display: "block", fontSize: 15, fontWeight: 700, marginBottom: 12, color: gold }}>
                1. เลือกรูปพื้นฐานที่ต้องการใช้งาน
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {basePhotos.map(bp => {
                  const isSelected = selectedBasePhoto === bp.imageUrl || (bp.id?.includes("wedding") && selectedBasePhoto.includes("wedding"));
                  return (
                    <div
                      key={bp.id}
                      onClick={() => {
                        setSelectedBasePhoto(bp.imageUrl);
                        // อัปเดตธีมเริ่มต้นให้เข้าคู่เพื่อความลื่นไหล
                        if (bp.id?.includes("wedding") || bp.imageUrl.includes("wedding")) {
                          setSelectedTheme("wedding");
                        }
                      }}
                      style={{
                        position: "relative", borderRadius: 12, overflow: "hidden", height: 70,
                        border: `2px solid ${isSelected ? gold : "transparent"}`,
                        cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      <img 
                        src={bp.imageUrl} 
                        alt={bp.name} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "rgba(0,0,0,0.6)", padding: "2px 0", textAlign: "center",
                        fontSize: 9, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden"
                      }}>
                        {bp.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ขั้นตอนที่ 2: อัปโหลดรูปภาพใบหน้า */}
            <div>
              <label style={{ display: "block", fontSize: 15, fontWeight: 700, marginBottom: 12, color: gold }}>
                2. อัปโหลดรูปภาพของคุณเพื่อเพิ่มลงในรูปพื้นฐาน
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
                  height: 160, border: `2px dashed ${borderColor}`, borderRadius: 20,
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
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📸</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>คลิกเพื่อเลือกภาพใบหน้าของคุณ</div>
                    <div style={{ fontSize: 11, color: textGray, marginTop: 4 }}>หน้าตรง มองกล้อง แสงชัดเจน</div>
                  </div>
                )}
              </div>
            </div>

            {/* ขั้นตอนที่ 3: เลือกแนวภาพ/ธีม AI */}
            <div>
              <label style={{ display: "block", fontSize: 15, fontWeight: 700, marginBottom: 12, color: gold }}>
                3. เลือกแนวภาพ / ธีม AI
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {themes.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                      borderRadius: 14, background: selectedTheme === t.id ? "rgba(212,175,55,0.15)" : "rgba(0,0,0,0.15)",
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
                    <span style={{ fontSize: 20 }}>{t.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: selectedTheme === t.id ? gold : "#fff" }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: textGray }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ขั้นตอนที่ 4: กดปุ่มสั่งเจนรูปภาพ */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !previewFile}
              style={{
                width: "100%", padding: "18px 0", borderRadius: 50, background: previewFile ? gold : "#555",
                color: previewFile ? darkBg : "#aaa", fontWeight: 800, fontSize: 16, border: "none",
                cursor: (isGenerating || !previewFile) ? "not-allowed" : "pointer", 
                opacity: isGenerating ? 0.6 : 1,
                boxShadow: previewFile ? `0 10px 30px rgba(212,175,55,0.25)` : "none", 
                transition: "transform 0.1s"
              }}
              onMouseDown={e => { if(!isGenerating && previewFile) e.currentTarget.style.transform = "scale(0.98)" }}
              onMouseUp={e => { if(!isGenerating && previewFile) e.currentTarget.style.transform = "scale(1)" }}
            >
              {isGenerating ? "ระบบ AI กำลังประมวลผล..." : "🚀 4. สั่งเจนรูป AI SNAP"}
            </button>
            {!previewFile && (
              <div style={{ fontSize: 12, color: "#ff4d4d", textAlign: "center", marginTop: -15, fontWeight: 600 }}>
                * กรุณาอัปโหลดรูปภาพของคุณก่อนสั่งประมวลผล
              </div>
            )}
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
                  กำลังประมวลผลรูปภาพด่านเดียว (gpt-image-2)
                </h3>
                <div style={{ fontSize: 14, color: "#fff", marginBottom: 6 }}>
                  {loadingSteps[currentStep]}
                </div>
                <div style={{ fontSize: 12, color: textGray }}>
                  ฐานข้อมูล D1 บันทึกสถานะ: <span style={{ color: "#FFB020", fontWeight: 600 }}>pending</span>
                </div>
              </div>
            ) : resultUrl ? (
              /* Success / Result UI */
              <div style={{ width: "100%", textAlign: "center" }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: gold, margin: "0 0 20px" }}>
                  ✨ ได้รับรูปภาพ AI สำเร็จเรียบร้อย!
                </h3>
                
                {/* Result Image */}
                <div style={{
                  maxWidth: "100%", borderRadius: 20, overflow: "hidden",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: `1px solid ${borderColor}`,
                  marginBottom: 28, background: "#000"
                }}>
                  <img src={resultUrl} alt="AI Snapshot Result" style={{ width: "100%", height: "auto", display: "block" }} />
                </div>

                {/* QR & Download options */}
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center",
                  justifyContent: "center", background: "rgba(0,0,0,0.2)",
                  padding: 24, borderRadius: 20, border: `1px solid ${borderColor}`
                }}>
                  {qrCodeUrl && (
                    <div style={{ background: "#fff", padding: 10, borderRadius: 12, width: 100, height: 100 }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCodeUrl)}`} alt="QR Code" style={{ width: "100%", height: "100%" }} />
                    </div>
                  )}
                  <div style={{ textAlign: "left", flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>สแกน QR Code เพื่อดาวน์โหลด</div>
                    <div style={{ fontSize: 12, color: textGray, marginBottom: 12 }}>หรือกดบันทึกรูปภาพทางด้านบนได้โดยตรง</div>
                    <a 
                      href={resultUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{
                        display: "inline-block", background: "transparent", border: `1px solid ${gold}`,
                        color: gold, textDecoration: "none", padding: "8px 16px", borderRadius: 8,
                        fontSize: 13, fontWeight: 700, transition: "background 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.1)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      เปิดรูปภาพขนาดเต็ม ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : errorMsg ? (
              /* Error UI */
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ff4d4d", margin: "0 0 8px" }}>เกิดข้อผิดพลาด</h3>
                <p style={{ fontSize: 14, color: textGray, margin: "0 0 20px" }}>{errorMsg}</p>
                <button
                  onClick={handleGenerate}
                  style={{
                    background: gold, color: darkBg, border: "none", padding: "10px 24px",
                    borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer"
                  }}
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            ) : (
              /* Idle UI */
              <div style={{ textAlign: "center", padding: 20, color: textGray }}>
                <div style={{ fontSize: 48, marginBottom: 16, color: "rgba(212,175,55,0.3)" }}>✨</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                  รอสั่งประมวลผลรูปภาพ
                </div>
                <div style={{ fontSize: 13 }}>
                  เลือกรูปพื้นหลัง อัปโหลดหน้าของคุณ เลือกสไตล์ และกดสั่งเจนรูปทางฝั่งซ้ายได้เลยครับ
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "30px 40px", borderTop: `1px solid ${borderColor}`,
        textAlign: "center", fontSize: 13, color: textGray,
        background: "rgba(10, 10, 10, 0.9)"
      }}>
        © 2026 AI SNAP Photobooth Project. Powered by Cloudflare D1 & R2 & Replicate.
      </footer>
    </div>
  );
}
