import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, MapPin, AlertCircle, ArrowRight, Check, User, Mail, Phone, Loader, Upload, X, FileText } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function IntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    productType: '', // aca, medicare, life, etc.
    state: 'FL',
    triggers: [],
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Capture UTMs on mount
  const utms = {
    utm_source: searchParams.get('utm_source'),
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign')
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        contactInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone
        },
        ...utms
      };

      const res = await fetch(`${API_URL}/api/leads/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (data.success) {
        // Save leadId and redirect to Schedule (which is the Microsoft Bookings page)
        localStorage.setItem('currentLeadId', data.leadId);

        // Upload files if any
        if (selectedFiles.length > 0) {
          for (const file of selectedFiles) {
             const formData = new FormData();
             formData.append('file', file);
             formData.append('lead_id', data.leadId);
             try {
                // Pre-check connectivity
                try {
                    const testRes = await fetch(`${API_URL}/api/client-docs/test`);
                    if (!testRes.ok) console.warn("Test endpoint failed");
                    else console.log("Test endpoint OK");
                } catch (e) {
                    console.error("Test endpoint network error", e);
                }

                const uploadUrl = `${API_URL}/api/client-docs/upload-file`;
                console.log(`Uploading to: ${uploadUrl}`);

                const uploadRes = await fetch(uploadUrl, {
                  method: 'POST',
                  body: formData
                });
                
                if (!uploadRes.ok) {
                    const errData = await uploadRes.json();
                    console.error('Upload failed:', errData);
                    alert(`Failed to upload file: ${file.name}. \nURL: ${uploadUrl} \nError: ${errData.detail || 'Unknown error'}`);
                }
             } catch (err) {
                console.error('File upload network error', err);
                alert(`Network error uploading ${file.name}. \nTarget: ${API_URL}/api/client-docs/upload-file \nCheck console for details.`);
             }
          }
        }
        
        
        // Smart Routing Logic based on Product Type
        // You could route to different booking pages here if needed
        navigate('/schedule'); 
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Intake error:', error);
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTrigger = (value) => {
    setFormData(prev => {
      const triggers = prev.triggers.includes(value)
        ? prev.triggers.filter(t => t !== value)
        : [...prev.triggers, value];
      return { ...prev, triggers };
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-900 dark:to-slate-900">
      {/* Navigation Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-white hover:text-blue-400 transition-colors"
            >
              <Shield className="h-5 w-5 text-blue-400" />
              <span className="text-lg font-bold">Elite Deal Broker</span>
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Home
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-medium py-1.5 px-3 rounded-lg text-sm transition-all border border-blue-500/30"
              >
                Admin Panel
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-56px)]">
      <div className="max-w-xl w-full bg-white dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/20 rounded-2xl shadow-2xl p-8 transition-all">
        
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-blue-500' : 'bg-gray-200 dark:bg-white/10'}`} />
          ))}
        </div>

        {/* Step 1: Product Selection */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">How can we help you today?</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Select the type of coverage you are looking for.</p>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'aca', label: 'Health Insurance (ACA/Obamacare)', icon: Shield },
                { id: 'medicare', label: 'Medicare (65+)', icon: User },
                { id: 'life', label: 'Life Insurance', icon: Check },
                { id: 'dental', label: 'Dental / Vision', icon: AlertCircle },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setFormData({ ...formData, productType: option.id });
                    handleNext();
                  }}
                  className={`flex items-center p-4 rounded-xl border transition-all text-left group ${
                    formData.productType === option.id 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100 ring-1 ring-blue-500' 
                    : 'border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className={`p-2 rounded-lg mr-4 ${formData.productType === option.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-white/10'}`}>
                    <option.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                    {option.label}
                  </span>
                  <ArrowRight className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: State Selection */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Where do you live?</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">We are licensed in Florida and select other states.</p>
            
            <div className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State</label>
                <select 
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white transition-all"
                >
                  <option value="FL">Florida</option>
                  <option value="TX">Texas</option>
                  <option value="GA">Georgia</option>
                  <option value="NC">North Carolina</option>
                  <option value="SC">South Carolina</option>
                  <option value="OTHER">Other State</option>
                </select>
               </div>

               <div className="flex gap-3 mt-8">
                 <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Back</button>
                 <button onClick={handleNext} className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all">Continue</button>
               </div>
            </div>
          </div>
        )}

        {/* Step 3: Trigger Questions */}
        {step === 3 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Just a few details...</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Select any that apply to you.</p>
            
            <div className="space-y-3 mb-8">
              {[
                { id: 'turning_65', label: 'Turning 65 soon' },
                { id: 'losing_coverage', label: 'Losing employer coverage' },
                { id: 'moved', label: 'Recently moved' },
                { id: 'chronic', label: 'Managing a chronic condition' },
                { id: 'medicaid', label: 'Have Medicaid / LIS' }
              ].map((trigger) => (
                <button
                  key={trigger.id}
                  onClick={() => toggleTrigger(trigger.id)}
                  className={`w-full flex items-center p-4 rounded-xl border text-left transition-all ${
                    formData.triggers.includes(trigger.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-white'
                    : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${
                    formData.triggers.includes(trigger.id)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-400 dark:border-gray-500'
                  }`}>
                    {formData.triggers.includes(trigger.id) && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="font-medium">{trigger.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all">Continue</button>
            </div>
          </div>
        )}

        {/* Step 4: Documents (New) */}
        {step === 4 && (
          <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Documents (Optional)</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Upload any relevant documents (ID, Income Proof, etc.) to a secure vault.</p>

            <div className="mb-6">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF, PNG, JPG (MAX. 10MB)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
                    }
                  }}
                />
              </label>
            </div>

            {/* File List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                      <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <button 
                      onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all">
                {selectedFiles.length > 0 ? `Upload ${selectedFiles.length} file(s) & Continue` : 'Skip / Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Contact Info */}
        {step === 5 && (
            <div className="animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Final Step</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Enter your contact info to schedule.</p>
            
            <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input 
                      type="text" 
                      value={formData.firstName}
                      onChange={e => setFormData({...formData, firstName: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                      placeholder="John"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Last Name</label>
                  <div className="relative">
                    <input 
                       type="text" 
                       value={formData.lastName}
                       onChange={e => setFormData({...formData, lastName: e.target.value})}
                       className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                       placeholder="Doe"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSubmit} 
              disabled={loading || !formData.email || !formData.firstName}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader className="animate-spin h-5 w-5" /> : 'Find a Time'}
            </button>
            <p className="text-xs text-center text-gray-400 mt-4">
              By clicking above, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
