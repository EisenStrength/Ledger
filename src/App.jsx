import React from 'react';
import { Activity, Shield, ChevronRight, MapPin, Clock, Instagram, Mail } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Navigation Bar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-500" size={28} />
            <span className="font-bold text-xl tracking-tighter">EISEN STRENGTH</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
            <a href="#about" className="hover:text-white transition">About</a>
            <a href="#location" className="hover:text-white transition">Location</a>
            <a href="#contact" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
          THE STANDARD FOR <span className="text-blue-500">STRENGTH.</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 leading-relaxed">
          Specialist powerlifting and strength training facility coming to the Southwest Sydney corridor.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-full font-bold transition flex items-center justify-center gap-2">
            Join the Waitlist <ChevronRight size={20} />
          </button>
          <button className="border border-slate-700 hover:bg-slate-800 px-8 py-4 rounded-full font-bold transition">
            Our Philosophy
          </button>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="max-w-6xl mx-auto px-6 pb-24 space-y-32">
        
        {/* About Section */}
        <section id="about" className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-block px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full uppercase tracking-widest">
              The Facility
            </div>
            <h2 className="text-3xl font-bold">Built by Coaches, for Athletes</h2>
            <p className="text-slate-400 leading-relaxed">
              EISEN Strength is designed to be the premier hub for IPF powerlifting and IWF weightlifting in Southwest Sydney. Whether you're a seasoned competitor or just starting your strength journey, we provide the equipment and environment needed to excel.
            </p>
            <ul className="space-y-3">
              {[
                "Competition grade Combo Racks",
                "Specialty bars & calibrated plates",
                "Expert coaching staff",
                "Dedicated community of lifters"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300">
                  <Shield size={18} className="text-blue-500" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-800 aspect-video rounded-2xl border border-slate-700 flex items-center justify-center">
             <p className="text-slate-500 italic">[Facility Preview Coming Soon]</p>
          </div>
        </section>

        {/* Info Grid */}
        <section id="location" className="grid md:grid-cols-3 gap-8">
          <div className="p-8 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition">
            <MapPin className="text-blue-500 mb-4" size={32} />
            <h3 className="text-xl font-bold mb-2">Location</h3>
            <p className="text-slate-400">Southwest Sydney Corridor<br />Near Campbelltown / Smeaton Grange</p>
          </div>
          <div className="p-8 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition">
            <Clock className="text-blue-500 mb-4" size={32} />
            <h3 className="text-xl font-bold mb-2">Opening Hours</h3>
            <p className="text-slate-400">24/7 Access for Members<br />Coached hours TBA</p>
          </div>
          <div className="p-8 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition">
            <Instagram className="text-blue-500 mb-4" size={32} />
            <h3 className="text-xl font-bold mb-2">Community</h3>
            <p className="text-slate-400">Follow us for build updates and launch dates.</p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer id="contact" className="border-t border-slate-800 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <Activity className="text-blue-500" size={20} />
              <span className="font-bold tracking-tight">EISEN STRENGTH</span>
            </div>
            <p className="text-slate-500 text-sm">Elevating the standard of strength training.</p>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 hover:text-white transition"><Instagram size={24} /></a>
            <a href="mailto:contact@eisenstrength.com" className="text-slate-400 hover:text-white transition"><Mail size={24} /></a>
          </div>
          <p className="text-slate-600 text-xs">
            &copy; {new Date().getFullYear()} EISEN Strength.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
