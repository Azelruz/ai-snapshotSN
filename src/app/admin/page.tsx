"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  createdAt: string;
}

export default function AdminPage() {
  const gold = "#D4AF37";
  const darkBg = "#0a0a0a";
  const surface = "#161616";
  const surfaceHover = "#1e1e1e";
  const textGray = "#999999";
  const borderColor = "rgba(212,175,55,0.15)";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFileBase64, setImageFileBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates for manual trigger (button clicks)
  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch {
      console.error("Failed to refresh templates");
    }
  };

  // Initial load
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        if (data.success && active) {
          setTemplates(data.templates);
        }
      } catch {
        if (active) setErrorMsg("Network error loading templates");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Handle template file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFileBase64(reader.result as string);
        setImageUrl(""); // Clear URL input if file is chosen
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit new template
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !prompt) {
      setErrorMsg("Please fill out name and prompt");
      return;
    }
    if (!imageUrl && !imageFileBase64) {
      setErrorMsg("Please either upload a photo or enter an image URL");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          prompt,
          aspectRatio,
          imageUrl,
          imageFileBase64
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMsg("Template added successfully!");
        // Reset Form
        setName("");
        setPrompt("");
        setAspectRatio("1:1");
        setImageUrl("");
        setImageFileBase64(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        // Refresh list
        fetchTemplates();
      } else {
        setErrorMsg(data.error || "Failed to add template");
      }
    } catch {
      setErrorMsg("Network error. Could not add template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete a template
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(`/api/templates?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMsg("Template deleted successfully!");
        fetchTemplates();
      } else {
        setErrorMsg(data.error || "Failed to delete template");
      }
    } catch {
      setErrorMsg("Network error deleting template");
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.04em" }}>
            AI<span style={{ color: gold }}>SNAP</span>
          </div>
          <div style={{
            background: "rgba(212,175,55,0.1)", border: `1px solid ${gold}`,
            color: gold, borderRadius: 6, padding: "2px 8px", fontSize: 11,
            fontWeight: 700, letterSpacing: "0.05em"
          }}>
            ADMIN PANEL
          </div>
        </div>
        <Link 
          href="/" 
          style={{
            color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6, border: `1px solid ${borderColor}`,
            padding: "8px 16px", borderRadius: 10, background: surface, transition: "background 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = surfaceHover}
          onMouseLeave={e => e.currentTarget.style.background = surface}
        >
          ← กลับหน้าแรกบอร์ดสติกเกอร์
        </Link>
      </header>

      {/* Main Grid */}
      <main style={{
        flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 32, maxWidth: 1400, width: "100%", margin: "0 auto", padding: "40px 20px",
        boxSizing: "border-box"
      }}>
        
        {/* Left Panel: Add New Base Photo Template Form */}
        <div style={{
          background: surface, borderRadius: 28, padding: 32,
          border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 24,
          height: "fit-content"
        }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: gold, margin: "0 0 4px" }}>
              เพิ่มรูปพื้นฐานใหม่ & Prompt
            </h2>
            <p style={{ color: textGray, fontSize: 13, margin: 0 }}>
              อัปโหลดรูปพื้นฐานขึ้น R2 และกำหนดคำสั่ง Prompt ล่าสุดที่จะใช้ผสมรูปภาพของแขก
            </p>
          </div>

          {errorMsg && (
            <div style={{
              background: "rgba(255, 77, 77, 0.1)", border: "1px solid #ff4d4d",
              color: "#ff4d4d", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: "rgba(46, 204, 113, 0.1)", border: "1px solid #2ecc71",
              color: "#2ecc71", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600
            }}>
              ✅ {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            
            {/* Template Name */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: gold }}>
                ชื่อป้ายตัวเลือกเทมเพลต (Template Name):
              </label>
              <input
                type="text"
                placeholder="เช่น บ่าวสาววิวาห์, ห้องของเล่นเด็ก"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${borderColor}`, borderRadius: 10, color: "#fff",
                  outline: "none", fontSize: 14, boxSizing: "border-box"
                }}
              />
            </div>

            {/* Template Image Source */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: gold }}>
                รูปภาพพื้นฐานหลัก (Base Image File/URL):
              </label>
              
              {/* File Upload to R2 */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 100, border: `2px dashed ${borderColor}`, borderRadius: 12,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", background: "rgba(0,0,0,0.2)", overflow: "hidden", marginBottom: 10
                }}
              >
                {imageFileBase64 ? (
                  <img src={imageFileBase64} alt="Upload Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", padding: 10 }}>
                    <div style={{ fontSize: 24 }}>🖼️</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>คลิกเพื่ออัปโหลดไฟล์ภาพเข้า R2</div>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: "none" }}
              />

              {/* Or Direct Image URL */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: textGray, marginBottom: 6 }}>
                <hr style={{ flex: 1, borderColor: "rgba(255,255,255,0.05)" }} />
                <span>หรือใส่วิงก์ลิงก์ภายนอก</span>
                <hr style={{ flex: 1, borderColor: "rgba(255,255,255,0.05)" }} />
              </div>
              
              <input
                type="text"
                placeholder="https://images.unsplash.com/photo-..."
                value={imageUrl}
                onChange={e => {
                  setImageUrl(e.target.value);
                  setImageFileBase64(null); // Clear file upload if URL is entered
                }}
                style={{
                  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${borderColor}`, borderRadius: 10, color: "#fff",
                  outline: "none", fontSize: 14, boxSizing: "border-box"
                }}
              />
            </div>

            {/* Aspect Ratio */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: gold }}>
                อัตราส่วนรูปภาพ (Aspect Ratio):
              </label>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                style={{
                  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${borderColor}`, borderRadius: 10, color: "#fff",
                  outline: "none", fontSize: 14, cursor: "pointer"
                }}
              >
                <option value="1:1">จัตุรัส 1:1 (ธีมตัวละครสไตล์คาแรกเตอร์ทั่วไป)</option>
                <option value="3:2">แนวนอน 3:2 (ดีฟอลต์สำหรับรูปงานแต่งงาน)</option>
              </select>
            </div>

            {/* Prompt */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: gold }}>
                คำสั่งควบคุม AI (Prompt):
              </label>
              <textarea
                placeholder="เช่น Add the person in this photo (reference image 2) to join in expressing congratulations..."
                rows={5}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                style={{
                  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.3)",
                  border: `1px solid ${borderColor}`, borderRadius: 10, color: "#fff",
                  outline: "none", fontSize: 14, fontFamily: "monospace", boxSizing: "border-box",
                  resize: "vertical"
                }}
              />
              <div style={{ fontSize: 11, color: textGray, marginTop: 4 }}>
                * สำหรับการอ้างอิงภาพ: <b>reference image 1</b> คือ รูปพื้นหลัง และ <b>reference image 2</b> คือ รูปหน้าแขกที่อัปโหลด
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 50, background: gold,
                color: darkBg, fontWeight: 800, fontSize: 15, border: "none",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: `0 8px 24px rgba(212,175,55,0.2)`
              }}
            >
              {isSubmitting ? "กำลังบันทึกข้อมูล..." : "💾 บันทึกรูปพื้นฐานเข้าระบบ D1"}
            </button>
          </form>
        </div>

        {/* Right Panel: Gallery of Existing Base Photo Templates */}
        <div style={{
          background: surface, borderRadius: 28, padding: 32,
          border: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", gap: 24
        }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: gold, margin: "0 0 4px" }}>
              รายการรูปพื้นฐานที่มีในสารบบ
            </h2>
            <p style={{ color: textGray, fontSize: 13, margin: 0 }}>
              รูปพื้นหลังเริ่มต้นทั้งหมดที่ดึงขึ้นมาแบบ Dynamic จาก D1 Database
            </p>
          </div>

          {isLoading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <div style={{
                width: 40, height: 40, border: "3px solid rgba(212,175,55,0.1)",
                borderTop: `3px solid ${gold}`, borderRadius: "50%",
                margin: "0 auto 20px", animation: "spin 1s linear infinite"
              }} />
              <div style={{ fontSize: 13, color: textGray }}>กำลังโหลดรูปพื้นหลัง...</div>
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: textGray }}>
              ไม่มีรูปภาพในระบบ
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {templates.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", gap: 16, background: "rgba(0,0,0,0.15)",
                    padding: 16, borderRadius: 18, border: `1px solid ${borderColor}`,
                    alignItems: "start"
                  }}
                >
                  {/* Template Image Preview */}
                  <div style={{
                    width: 90, height: 90, borderRadius: 12, overflow: "hidden",
                    border: `1px solid ${borderColor}`, background: "#000", flexShrink: 0
                  }}>
                    <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>

                  {/* Template Info */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: gold }}>{item.name}</span>
                      <span style={{
                        fontSize: 10, background: "rgba(255,255,255,0.08)",
                        padding: "2px 6px", borderRadius: 4, color: textGray
                      }}>
                        {item.aspectRatio}
                      </span>
                    </div>
                    
                    {/* Truncated Prompt */}
                    <div style={{
                      fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.2)",
                      padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)",
                      maxHeight: 60, overflowY: "auto", fontFamily: "monospace"
                    }}>
                      {item.prompt}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: textGray }}>
                        ID: {item.id}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          background: "transparent", border: "none", color: "#ff4d4d",
                          fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 8px",
                          borderRadius: 6, transition: "background 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 77, 77, 0.1)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        🗑️ ลบเทมเพลต
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
