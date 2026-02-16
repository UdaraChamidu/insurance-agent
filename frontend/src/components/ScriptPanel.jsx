import React from 'react';
import { Shield, AlertTriangle, FileText } from 'lucide-react';

const SCRIPTS = {
  medicare: {
    title: 'Medicare Compliance Script',
    intro: "Hello, my name is [Name] and I am a licensed sales agent. I am not employed by Medicare or the federal government.",
    disclaimer: "We do not offer every plan available in your area. Any information we provide is limited to those plans we do offer in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.",
    checklist: [
      "Confirm they have Medicare Parts A & B",
      "Ask about current coverage",
      "Check if they receive Extra Help (LIS)",
      "Verify doctor and prescription preferences"
    ]
  },
  aca: {
    title: 'ACA / Health Insurance Script',
    intro: "Hello, I'm a licensed agent looking to help you find the best health coverage for your needs.",
    disclaimer: "I can help you enroll in a Marketplace plan. Eligibility for subsidies depends on your income and household size.",
    checklist: [
      "Ask about household income (for subsidy)",
      "Confirm zip code",
      "Check for qualifying life events if outside Open Enrollment",
      "Ask about preferred doctors/hospitals"
    ]
  },
  life: {
    title: 'Life Insurance Script',
    intro: "Hi, I'm a licensed field underwriter. My job is to verify your information and see what plans you qualify for.",
    disclaimer: "Policy issuance depends on answers to health questions and underwriting approval.",
    checklist: [
      "Confirm age and smoking status",
      "Ask about beneficiary needs",
      "Ask about current health conditions",
      "Determine budget range"
    ]
  },
  default: {
    title: 'General Consultation Script',
    intro: "Hello, how can I help you today?",
    disclaimer: "I am a licensed insurance agent.",
    checklist: [
      "Identify client needs",
      "Confirm contact information",
      "Explain process"
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
