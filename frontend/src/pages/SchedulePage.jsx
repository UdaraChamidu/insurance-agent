import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Mapping Product Types to Booking URLs
// TODO: Replace with actual client Booking URLs
const BOOKING_URLS = {
  medicare: "https://outlook.office365.com/book/MedicareConsultation@helmygenesis.com",
  aca: "https://outlook.office365.com/book/HealthInsuranceACA@helmygenesis.com",
  life: "https://outlook.office365.com/book/LifeInsurance@helmygenesis.com",
  default: "https://outlook.office365.com/book/GeneralConsultation@helmygenesis.com" // Fallback
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const [bookingUrl, setBookingUrl] = useState(BOOKING_URLS.default);
  const [loading, setLoading] = useState(true);
  const [leadName, setLeadName] = useState('');

  useEffect(() => {
    const fetchLeadContext = async () => {
      const leadId = localStorage.getItem('currentLeadId');
      if (!leadId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/leads/${leadId}`);
        if (res.ok) {
          const data = await res.json();
          // Route to correct calendar based on product
          const product = data.productType?.toLowerCase();
          const targetUrl = BOOKING_URLS[product] || BOOKING_URLS.default;
          
          setBookingUrl(targetUrl);
          if (data.contactInfo?.firstName) {
            setLeadName(data.contactInfo.firstName);
          }
        }
      } catch (error) {
        console.error('Failed to fetch lead context:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeadContext();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-slate-900 transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Home
        </button>

        <div className="bg-white dark:bg-white/5 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-white/10">
          <div className="p-8 text-center border-b border-gray-100 dark:border-white/5">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {leadName ? `Welcome, ${leadName}!` : 'Schedule Your Consultation'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Select a time below to speak with a licensed agent.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-black/20" style={{ minHeight: '600px' }}>
            {loading ? (
              <div className="flex items-center justify-center h-[600px]">
                <Loader className="h-10 w-10 text-blue-500 animate-spin" />
              </div>
            ) : (
              <iframe
                src={bookingUrl}
                width="100%"
                height="800"
                frameBorder="0"
                className="w-full h-full"
                title="Microsoft Bookings"
                allowFullScreen
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
