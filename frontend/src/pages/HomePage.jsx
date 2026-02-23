import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Calendar, ArrowRight, CheckCircle, MessageCircle, Send, X, Bot } from 'lucide-react';
import publicChatService from '../services/publicChatService';

const HOMEPAGE_FAQ_ITEMS = [
  {
    question: 'What services do you offer?',
    answer:
      'We help with individual and family health insurance, Medicare guidance, small business coverage, and life or supplemental insurance consultations.',
  },
  {
    question: 'How do I book a consultation?',
    answer:
      'Click "Schedule Consultation", complete intake, select an available slot, and confirm your appointment.',
  },
  {
    question: 'How does the meeting work?',
    answer:
      'You join a secure meeting link and speak with an agent. The process is designed for clear guidance and fast follow-up.',
  },
  {
    question: 'How long is a consultation?',
    answer:
      'Most consultations are around 30 minutes, depending on your needs and questions.',
  },
  {
    question: 'Can I cancel or reschedule?',
    answer:
      'Yes. You can use your appointment management link to cancel or reschedule easily.',
  },
  {
    question: 'Is there any obligation to buy?',
    answer:
      'No. The consultation is guidance-first and no-obligation in positioning.',
  },
];

const INITIAL_CHAT_MESSAGE = {
  id: 'welcome-chat',
  role: 'assistant',
  content:
    "Hi! I’m here to answer your questions about the platform and services. If you need personal plan advice, please book a consultation.",
};

export default function HomePage() {
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([INITIAL_CHAT_MESSAGE]);
  const messagesEndRef = useRef(null);
  const chatSessionIdRef = useRef(`public-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const chatMessagesRef = useRef([INITIAL_CHAT_MESSAGE]);

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

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages, isChatOpen]);

  const addChatMessage = (message) => {
    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...message
    };
    setChatMessages((prev) => [...prev, payload]);
  };

  const sendChatMessage = async (rawText = null) => {
    const text = (rawText ?? chatInput).trim();
    if (!text || isChatSending) return;

    addChatMessage({ role: 'user', content: text });
    setChatInput('');
    setIsChatSending(true);

    const history = chatMessagesRef.current
      .slice(-8)
      .map((item) => ({ role: item.role, content: item.content }));

    try {
      const response = await publicChatService.askQuestion({
        message: text,
        sessionId: chatSessionIdRef.current,
        mode: 'chat',
        history
      });

      addChatMessage({
        role: 'assistant',
        content: response?.answer || 'I can help with booking and platform questions.'
      });
    } catch (error) {
      console.error('Public chat error:', error);
      addChatMessage({
        role: 'assistant',
        content:
          'I could not respond right now. You can still book a consultation and speak with an agent directly.'
      });
    } finally {
      setIsChatSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative">
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
                <a href="#faq" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Q&A</a>
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

      {/* Q&A Section */}
      <section id="faq" className="py-20 bg-black/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-bold text-white mb-3">Common Questions</h3>
            <p className="text-gray-400">Quick answers before you schedule your consultation.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {HOMEPAGE_FAQ_ITEMS.map((item) => (
              <div key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h4 className="text-white font-semibold text-base mb-2">{item.question}</h4>
                <p className="text-gray-300 text-sm leading-relaxed">{item.answer}</p>
              </div>
            ))}
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

      {!isChatOpen && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition-colors"
          aria-label="Open chatbot"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-semibold">Ask Us</span>
        </button>
      )}

      {isChatOpen && (
        <div className="fixed bottom-4 right-3 z-50 w-[calc(100vw-1.5rem)] sm:w-[390px] h-[560px] max-h-[78vh] rounded-2xl border border-white/15 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-600/20 border border-blue-500/30 p-1.5">
                  <Bot className="h-4 w-4 text-blue-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Platform Assistant</p>
                  <p className="text-[11px] text-gray-400">General info, services, booking flow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="rounded-md p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close chatbot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
            {chatMessages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/8 border border-white/10 text-gray-100'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isChatSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white/8 border border-white/10 px-3 py-2 text-xs text-gray-300">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="shrink-0 border-t border-white/10 px-3 py-2 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendChatMessage();
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask anything about the platform or services..."
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={350}
            />
            <button
              type="submit"
              disabled={isChatSending || !chatInput.trim()}
              className="rounded-xl bg-blue-600 p-2.5 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
