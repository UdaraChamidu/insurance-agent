import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, FileText, Check, AlertCircle, X, Shield, Loader2 } from 'lucide-react';
import clientDocsService from '../services/clientDocsService';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.tiff'];
const MAX_SIZE_MB = 25;
const DOCUMENT_FOLDERS = ['Prospecting', 'Active Quotes', 'Sold Groups', 'Renewals', 'Compliance-Docs'];

export default function SecureUploadPage() {
  const { token } = useParams();
  const [leadInfo, setLeadInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    async function validate() {
      try {
        setLoading(true);
        const data = await clientDocsService.getPortalInfo(token);
        setLeadInfo(data.lead);
      } catch (err) {
        setError('This upload link is invalid or has expired. Please contact your insurance consultant for a new link.');
      } finally {
        setLoading(false);
      }
    }
    if (token) validate();
  }, [token]);

  const validateFile = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type ${ext} is not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles) => {
    const validated = Array.from(newFiles).map((f) => {
      const error = validateFile(f);
      return { file: f, error, id: Math.random().toString(36).slice(2) };
    });
    setFiles((prev) => [...prev, ...validated]);
  }, []);

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    const validFiles = files.filter((f) => !f.error);
    if (!validFiles.length) return;

    setUploading(true);
    const results = [];

    for (const { file, id } of validFiles) {
      try {
        const result = await clientDocsService.portalUpload({
          token,
          file,
          description,
          folder: folder || undefined,
        });
        results.push({ id, filename: file.name, success: true, data: result });
      } catch (err) {
        results.push({ id, filename: file.name, success: false, error: err.message });
      }
    }

    setUploadResults(results);
    setFiles([]);
    setDescription('');
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Validating your upload link...</p>
        </div>
      </div>
    );
  }

  if (error || !leadInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Upload Link Invalid</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const validCount = files.filter((f) => !f.error).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-4">
            <Shield className="h-4 w-4" />
            Secure Upload Portal
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Document Upload{leadInfo.companyName ? ` - ${leadInfo.companyName}` : ''}
          </h1>
          <p className="text-gray-600 mt-2">
            Upload your documents securely. Accepted formats: PDF, Excel, CSV, Word, and images.
          </p>
        </div>

        {/* Upload results */}
        {uploadResults.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Upload Results</h2>
            {uploadResults.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
                  r.success
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {r.success ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span className="font-medium">{r.filename}</span>
                {r.success ? (
                  <span className="ml-auto text-green-600">Uploaded successfully</span>
                ) : (
                  <span className="ml-auto">{r.error}</span>
                )}
              </div>
            ))}
            <button
              onClick={() => setUploadResults([])}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Upload more files
            </button>
          </div>
        )}

        {/* Drop zone */}
        {uploadResults.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
              onClick={() => document.getElementById('file-input').click()}
            >
              <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-700 font-medium">
                Drag & drop files here, or <span className="text-blue-600">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Max {MAX_SIZE_MB} MB per file. Accepted: {ALLOWED_EXTENSIONS.join(', ')}
              </p>
              <input
                id="file-input"
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(',')}
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map(({ file, error, id }) => (
                  <div
                    key={id}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${
                      error
                        ? 'bg-red-50 border border-red-200 text-red-700'
                        : 'bg-gray-50 border border-gray-200 text-gray-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      {error ? (
                        <p className="text-xs text-red-500">{error}</p>
                      ) : (
                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                      )}
                    </div>
                    <button onClick={() => removeFile(id)} className="shrink-0 p-1 hover:bg-gray-200 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Category</label>
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Auto-detect</option>
                  {DOCUMENT_FOLDERS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Q2 census data"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={uploading || validCount === 0}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {validCount} {validCount === 1 ? 'File' : 'Files'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          Your files are encrypted and securely stored. If you have questions, contact your consultant.
        </p>
      </div>
    </div>
  );
}
