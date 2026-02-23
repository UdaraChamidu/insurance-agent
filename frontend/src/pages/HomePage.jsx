import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Calendar, ArrowRight, CheckCircle } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const helpTopics = [
    'Individual & family health insurance',
    'Medicare guidance',
    'Small business coverage',
    'Life & supplemental insurance',
  ];

  const howItWorksSteps = [
    {
      title: 'Share Your Needs',
      icon: Users,
      description:
        'Designed for ease, this solution offers reliable performance and effortless usability for everyday needs.',
    },
    {
      title: 'Review Your Options',
      icon: Calendar,
      description:
        'Designed for ease, this solution offers reliable performance and effortless usability for everyday needs.',
    },
    {
      title: 'Get Personalized Guidance',
      icon: Shield,
      description:
        'Designed for ease, this solution offers reliable performance and effortless usability for everyday needs.',
    },
  ];

  const trustPoints = [
    'Licensed professionals',
    'Compliance-first approach',
    'Personalized, human guidance',
    'No-obligation consultation',
  ];

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
            <nav className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-5">
                <button
                  onClick={() => navigate('/intake')}
                  className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Book Consultation
                </button>
                <a href="#services" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Services</a>
                <a href="#contact" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Contact</a>
              </div>
              <button
                onClick={() => navigate('/admin')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg text-sm transition-all shadow-lg shadow-blue-600/20 border border-blue-500/30"
              >
                Admin Panel
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
              Clear, Human Guidance for <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Health Insurance Decisions</span>
            </h2>
            
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              We help individuals, families, and small businesses navigate health insurance options with clarity, compliance, and personal attention.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/intake')}
                className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 w-full sm:w-auto"
              >
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <span>Schedule Consultation</span>
                  <ArrowRight className="h-5 w-5 bg-white/20 rounded-full p-1 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
              <a
                href="https://www.elitedealbroker.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold text-lg transition-all backdrop-blur-sm hover:border-white/20 w-full sm:w-auto flex items-center justify-center"
              >
                Explore Services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-10 mb-20">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl">
              <h3 className="text-3xl font-bold text-white mb-6">WHAT WE HELP WITH</h3>
              <ul className="space-y-4">
                {helpTopics.map((topic) => (
                  <li key={topic} className="flex items-start gap-3 text-gray-200">
                    <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl">
              <h3 className="text-3xl font-bold text-white mb-6">Why Choose Elite Deal Broker</h3>
              <ul className="space-y-4 mb-8">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-gray-200">
                    <CheckCircle className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className="text-gray-300 italic border-l-2 border-cyan-400/60 pl-4">
                Our role is to help you understand - not to pressure you.
              </p>
            </div>
          </div>

          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">HOW IT WORKS</h3>
            <p className="text-gray-400">Three simple steps to move from uncertainty to confidence.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorksSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-cyan-300 mb-2">Step {index + 1}</p>
                  <h4 className="text-xl font-bold text-white mb-3">{step.title}</h4>
                  <p className="text-gray-300 leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Secure Your Future?</h2>
          <p className="text-xl text-gray-300 mb-10">
            Book a free, no-obligation consultation with our top-rated agents today.
          </p>
          <button
            onClick={() => navigate('/intake')}
            className="inline-flex items-center px-8 py-4 bg-white text-blue-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/10"
          >
            <CheckCircle className="mr-2 h-5 w-5 text-blue-600" />
            Book Your Session
          </button>
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
