export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navigation */}
      <header className="w-full py-6 px-8 flex justify-between items-center border-b border-border-color">
        <div className="font-bold text-2xl tracking-tighter">AI SNAP</div>
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          <a href="#features" className="hover:text-gold transition-colors">Features</a>
          <a href="#themes" className="hover:text-gold transition-colors">Themes</a>
          <a href="#pricing" className="hover:text-gold transition-colors">Pricing</a>
        </nav>
        <button className="bg-foreground text-background px-6 py-2 rounded-full text-sm font-medium hover:bg-gold hover:text-white transition-all transform hover:scale-95">
          Book Demo
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold opacity-10 rounded-full blur-[100px] pointer-events-none"></div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-tight mb-6 z-10">
          The Ultimate <span className="text-gold">AI Photobooth</span> Experience.
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mb-10 z-10">
          Transform your events with world-class AI imaging. Instantly generate stunning, premium avatars for your guests.
        </p>
        
        <div className="flex gap-4 z-10">
          <button className="bg-gold text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-gold-hover shadow-[0_10px_30px_rgba(212,175,55,0.3)] transition-all transform hover:scale-95">
            Get Started
          </button>
          <button className="bg-surface text-foreground border border-border-color px-8 py-4 rounded-full text-lg font-semibold hover:bg-soft-gray transition-all transform hover:scale-95">
            View Gallery
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500 border-t border-border-color">
        &copy; {new Date().getFullYear()} AI SNAP Platform. All rights reserved.
      </footer>
    </div>
  );
}
