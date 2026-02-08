import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Calendar, Phone, ArrowRight, CheckCircle } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-wide">Elite Deal Broker</h1>
            </div>
            <nav className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6">
                <a href="#services" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Services</a>
                <a href="#about" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">About</a>
                <a href="#contact" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Contact</a>
              </div>
              <button
                onClick={() => navigate('/admin')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20 border border-blue-500/30"
              >
                Admin Login
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Abstract Background Orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-300 text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-blue-400 mr-2 animate-pulse"></span>
              Licensed Health & Life Insurance Experts
            </div>
            
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight tracking-tight">
              Protect What <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Matters Most</span>
            </h2>
            
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Experience personalized insurance solutions with expert guidance. Schedule a consultation and discover the perfect coverage for your future.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="https://outlook.office.com/book/EliteDealBroker6@helmygenesis.com/?ismsaljsauthenabled"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 w-full sm:w-auto"
              >
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span>Schedule Consultation</span>
                  <ArrowRight className="h-5 w-5 bg-white/20 rounded-full p-1 transition-transform group-hover:translate-x-1" />
                </div>
              </a>
              <button className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all backdrop-blur-sm hover:border-white/20 w-full sm:w-auto">
                Explore Services
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="services" className="py-24 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-white mb-4">Why Choose Elite Deal Broker?</h3>
            <p className="text-gray-400">Comprehensive protection tailored to your unique lifestyle.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Comprehensive Coverage</h3>
              <p className="text-gray-400 leading-relaxed">
                Life, health, auto, and home insurance plans designed to provide maximum security for you and your family.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <Users className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Expert Advisors</h3>
              <p className="text-gray-400 leading-relaxed">
                Access to licensed professionals dedicated to finding the best rates and coverage options available.
              </p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <Phone className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">24/7 Support</h3>
              <p className="text-gray-400 leading-relaxed">
                Round-the-clock assistance for claims, questions, and emergency support whenever you need it most.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Secure Your Future?</h2>
          <p className="text-xl text-gray-300 mb-10">
            Book a free, no-obligation consultation with our top-rated agents today.
          </p>
          <a
            href="https://outlook.office.com/book/EliteDealBroker6@helmygenesis.com/?ismsaljsauthenabled"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/10"
          >
            <CheckCircle className="mr-2 h-5 w-5 text-blue-600" />
            Book Your Free Session
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/40 border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-400 mb-6">&copy; 2024 SecureLife Insurance. All rights reserved.</p>
          <div className="flex justify-center gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
