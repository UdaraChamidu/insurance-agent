import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Calendar, Phone } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">SecureLife Insurance</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#services" className="text-gray-700 hover:text-blue-600">Services</a>
              <a href="#about" className="text-gray-700 hover:text-blue-600">About</a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600">Contact</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-extrabold text-gray-900 mb-6">
            Protect What Matters Most
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Get personalized insurance solutions with expert guidance. Schedule a consultation 
            with our licensed agents and discover the perfect coverage for your needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/schedule')}
              className="btn-primary text-lg px-8 py-4 inline-flex items-center"
            >
              <Calendar className="mr-2 h-5 w-5" />
              Schedule Consultation
            </button>
            <button className="btn-secondary text-lg px-8 py-4">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Comprehensive Coverage</h3>
            <p className="text-gray-600">
              Life, health, auto, and home insurance tailored to your unique situation.
            </p>
          </div>
          
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Users className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Expert Advisors</h3>
            <p className="text-gray-600">
              Licensed professionals with years of experience helping families secure their future.
            </p>
          </div>
          
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Phone className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">24/7 Support</h3>
            <p className="text-gray-600">
              Round-the-clock assistance when you need it most, including emergency claims.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Book a free consultation with one of our insurance experts today.
          </p>
          <button
            onClick={() => navigate('/schedule')}
            className="bg-white text-blue-600 hover:bg-gray-100 font-bold py-3 px-8 rounded-lg text-lg transition-colors"
          >
            Schedule Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p>&copy; 2024 SecureLife Insurance. All rights reserved.</p>
            <div className="mt-4 space-x-6">
              <a href="#" className="hover:text-blue-400">Privacy Policy</a>
              <a href="#" className="hover:text-blue-400">Terms of Service</a>
              <a href="#" className="hover:text-blue-400">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
