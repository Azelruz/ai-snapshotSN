"use client";

export default function Home() {
  const gold = "#D4AF37";
  const goldLight = "rgba(212,175,55,0.12)";
  const darkBg = "#0a0a0a";
  const softGray = "#f5f5f7";
  const borderColor = "rgba(0,0,0,0.08)";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", background: "#fafafa" }}>

      {/* Navigation */}
      <header style={{
        width: "100%", padding: "20px 40px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${borderColor}`, background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100,
        boxSizing: "border-box",
      }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.04em", color: darkBg }}>
          AI<span style={{ color: gold }}>SNAP</span>
        </div>
        <nav style={{ display: "flex", gap: 32, fontSize: 14, fontWeight: 500, color: "#555" }}>
          {["Features", "Themes", "Pricing"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              style={{ color: "#555", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = gold)}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
              {item}
            </a>
          ))}
        </nav>
        <a href="#demo" style={{
          background: darkBg, color: "#fff", padding: "10px 24px",
          borderRadius: 50, fontSize: 14, fontWeight: 600, textDecoration: "none",
          transition: "background 0.2s, transform 0.1s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = gold; e.currentTarget.style.transform = "scale(0.97)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = darkBg; e.currentTarget.style.transform = "scale(1)"; }}>
          Book Demo
        </a>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "100px 24px", position: "relative", overflow: "hidden" }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700, height: 700,
          background: `radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)`,
          pointerEvents: "none", borderRadius: "50%",
        }} />

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: goldLight, border: `1px solid rgba(212,175,55,0.3)`,
          borderRadius: 50, padding: "6px 18px", fontSize: 13, fontWeight: 600,
          color: "#8B6914", marginBottom: 28, zIndex: 1,
        }}>
          ✨ AI-Powered Photobooth Platform
        </div>

        {/* H1 */}
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800,
          lineHeight: 1.1, letterSpacing: "-0.03em", maxWidth: 800,
          color: darkBg, margin: "0 0 24px", zIndex: 1,
        }}>
          The Ultimate{" "}
          <span style={{ color: gold }}>AI Photobooth</span>
          {" "}Experience.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: "clamp(16px, 2vw, 20px)", color: "#666", maxWidth: 560,
          lineHeight: 1.7, margin: "0 0 48px", fontWeight: 400, zIndex: 1,
        }}>
          Transform your events with world-class AI imaging. Instantly generate stunning, premium avatars for your guests.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", zIndex: 1 }}>
          <a href="#start" style={{
            background: gold, color: "#fff", padding: "16px 40px",
            borderRadius: 50, fontSize: 16, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 12px 40px rgba(212,175,55,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(212,175,55,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(212,175,55,0.35)"; }}>
            Get Started →
          </a>
          <a href="#gallery" style={{
            background: "#fff", color: darkBg, padding: "16px 40px",
            borderRadius: 50, fontSize: 16, fontWeight: 600, textDecoration: "none",
            border: `1px solid ${borderColor}`, boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            transition: "transform 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(0.97)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            View Gallery
          </a>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" style={{ padding: "80px 40px", background: softGray }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16, color: darkBg }}>
            Everything you need.
          </h2>
          <p style={{ textAlign: "center", color: "#666", fontSize: 18, marginBottom: 60 }}>
            Built for events of every scale — from intimate weddings to massive festivals.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {[
              { icon: "📸", title: "Smart Camera", desc: "AI-powered face detection and smart framing for perfect shots every time." },
              { icon: "🎨", title: "100+ AI Themes", desc: "From Anime to Luxury, Royal to Cyberpunk — themes for every event." },
              { icon: "⚡", title: "Instant Generation", desc: "AI generates stunning portrait art in under 15 seconds." },
              { icon: "🖨️", title: "Instant Print", desc: "Supports multiple printer brands with auto-queue management." },
              { icon: "📱", title: "QR Download", desc: "Secure QR codes for easy sharing to Instagram, TikTok, and more." },
              { icon: "📊", title: "Live Analytics", desc: "Real-time dashboard tracking visitors, prints, and AI performance." },
            ].map(f => (
              <div key={f.title} style={{
                background: "#fff", borderRadius: 24, padding: 32,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.04)"; }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: darkBg, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: "#777", lineHeight: 1.6, fontSize: 15, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: "80px 40px", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16, color: darkBg }}>
            Simple Pricing.
          </h2>
          <p style={{ textAlign: "center", color: "#666", fontSize: 18, marginBottom: 60 }}>No hidden fees. Pay for what you use.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24, alignItems: "start" }}>
            {[
              { plan: "Starter", price: "Pay/Event", desc: "Perfect for freelancers & small events", features: ["500 images/event", "3 AI themes", "QR downloads", "Basic analytics"], highlight: false },
              { plan: "Professional", price: "Custom/Month", desc: "For agencies & active organizers", features: ["Unlimited events", "All premium themes", "White-label (no watermark)", "Priority AI queue", "Full analytics"], highlight: true },
              { plan: "Enterprise", price: "Contact Us", desc: "For brands, malls & large venues", features: ["Unlimited everything", "Custom AI model", "Dedicated server", "API access", "24/7 support"], highlight: false },
            ].map(p => (
              <div key={p.plan} style={{
                background: p.highlight ? darkBg : "#fff",
                color: p.highlight ? "#fff" : darkBg,
                borderRadius: 24, padding: 36,
                border: p.highlight ? `2px solid ${gold}` : `1px solid ${borderColor}`,
                boxShadow: p.highlight ? `0 20px 60px rgba(0,0,0,0.2)` : "0 4px 24px rgba(0,0,0,0.04)",
                transform: p.highlight ? "scale(1.04)" : "scale(1)",
              }}>
                {p.highlight && (
                  <div style={{ background: gold, color: "#fff", borderRadius: 50, padding: "4px 14px", fontSize: 12, fontWeight: 700, display: "inline-block", marginBottom: 16 }}>
                    MOST POPULAR
                  </div>
                )}
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>{p.plan}</h3>
                <div style={{ fontSize: 20, fontWeight: 700, color: gold, margin: "8px 0" }}>{p.price}</div>
                <p style={{ fontSize: 14, color: p.highlight ? "#aaa" : "#888", marginBottom: 24 }}>{p.desc}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px" }}>
                  {p.features.map(f => (
                    <li key={f} style={{ fontSize: 14, padding: "6px 0", borderBottom: `1px solid ${p.highlight ? "rgba(255,255,255,0.1)" : borderColor}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: gold }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a href="#demo" style={{
                  display: "block", textAlign: "center",
                  background: p.highlight ? gold : darkBg,
                  color: "#fff", padding: "14px 24px", borderRadius: 50,
                  fontWeight: 700, fontSize: 15, textDecoration: "none",
                }}>
                  {p.plan === "Enterprise" ? "Contact Sales" : "Get Started"}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "40px", textAlign: "center", fontSize: 14, color: "#999",
        borderTop: `1px solid ${borderColor}`, background: softGray,
      }}>
        © {new Date().getFullYear()} AI SNAP Platform · Built for world-class events
      </footer>
    </div>
  );
}
