import React from 'react';
import { Shield, AlertTriangle, FileText } from 'lucide-react';

const SCRIPTS = {
  aca: {
    title: 'ACA Marketplace Script',
    intro: "Hello, I'm here to help you review Marketplace coverage options and the enrollment steps that apply to your situation.",
    disclaimer: 'Eligibility for Marketplace subsidies depends on your household and application details through the official enrollment process.',
    checklist: [
      'Ask about household income considerations',
      'Confirm zip code and state',
      'Check for qualifying life events if outside Open Enrollment',
      'Ask about preferred doctors, hospitals, and prescriptions'
    ]
  },
  shop: {
    title: 'SHOP Small Business Script',
    intro: "Hello, I'm here to help you review small business health insurance options and whether SHOP is the right fit for your team.",
    disclaimer: 'Eligibility, participation, and tax credit considerations depend on the employer setup and the market rules that apply.',
    checklist: [
      'Confirm business size and employee count',
      'Ask about current group coverage or renewal timing',
      'Review employer contribution goals',
      'Ask about provider or plan priorities for employees'
    ]
  },
  default: {
    title: 'General Consultation Script',
    intro: 'Hello, how can I help you with ACA Marketplace or SHOP coverage today?',
    disclaimer: 'We focus on ACA Marketplace and SHOP health insurance guidance.',
    checklist: [
      'Identify whether the request is individual or small business',
      'Confirm contact information',
      'Explain the next enrollment steps'
    ]
  }
};

export default function ScriptPanel({ productType }) {
  const content = SCRIPTS[productType?.toLowerCase()] || SCRIPTS.default;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b dark:border-gray-700">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{content.title}</h3>
      </div>

      <div className="space-y-6">
        {/* Intro */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
          <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Intro</h4>
          <p className="text-sm text-blue-900 dark:text-blue-100 italic">"{content.intro}"</p>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Mandatory Disclaimer</h4>
          </div>
          <p className="text-xs text-amber-900 dark:text-amber-100">{content.disclaimer}</p>
        </div>

        {/* Checklist */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Required Questions
          </h4>
          <ul className="space-y-2">
            {content.checklist.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input type="checkbox" className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
