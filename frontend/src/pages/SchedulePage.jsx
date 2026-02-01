import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';

export default function SchedulePage() {
  const navigate = useNavigate();
  const [bookingComplete, setBookingComplete] = useState(false);
  
  // Replace with your actual Microsoft Booking URL
  const MICROSOFT_BOOKING_URL = "https://outlook.office365.com/book/YourBookingPage";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Home
        </button>

        <div className="card">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Calendar className="h-16 w-16 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Schedule Your Consultation
            </h1>
            <p className="text-gray-600">
              Choose a convenient time to speak with one of our insurance experts
            </p>
          </div>

          {!bookingComplete ? (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">What to Expect:</h3>
                <ul className="list-disc list-inside text-blue-800 space-y-2">
                  <li>30-minute video consultation</li>
                  <li>Personalized insurance recommendations</li>
                  <li>No obligation, completely free</li>
                  <li>Meeting link sent to your email</li>
                </ul>
              </div>

              {/* Microsoft Booking Embed */}
              <div className="bg-white rounded-lg overflow-hidden" style={{ minHeight: '600px' }}>
                <iframe
                  src={MICROSOFT_BOOKING_URL}
                  width="100%"
                  height="600"
                  frameBorder="0"
                  style={{ border: 'none' }}
                  title="Microsoft Bookings"
                  onLoad={() => {
                    // Optionally detect when booking is complete
                    // This is a simplified example - you may need more sophisticated detection
                  }}
                />
              </div>

              {/* Alternative: Manual Booking Form (if not using Microsoft Booking iframe) */}
              {/* 
              <form className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type of Insurance
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option>Life Insurance</option>
                    <option>Health Insurance</option>
                    <option>Auto Insurance</option>
                    <option>Home Insurance</option>
                    <option>Business Insurance</option>
                    <option>Not Sure / Multiple</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about your insurance needs..."
                  />
                </div>

                <button
                  type="submit"
                  onClick={(e) => {
                    e.preventDefault();
                    setBookingComplete(true);
                  }}
                  className="w-full btn-primary text-lg py-3"
                >
                  Schedule Consultation
                </button>
              </form>
              */}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Consultation Scheduled!
              </h2>
              <p className="text-gray-600 mb-6">
                We've sent a confirmation email with your meeting link.
              </p>
              <button
                onClick={() => navigate('/')}
                className="btn-primary"
              >
                Return to Home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
