import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle, XCircle } from 'lucide-react';

export default function FileUploader({ 
  label, 
  helpText = "- Max 10MB", 
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png", 
  maxSizeMB = 10,
  onFileSelect,
  file
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return false;

    // Check size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`Il file è troppo grande. Massimo consentito: ${maxSizeMB}MB`);
      return false;
    }

    // Check extension (basic validation based on accept string)
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    const acceptedTypes = accept.split(',').map(e => e.trim());
    if (!acceptedTypes.includes(ext)) {
      setError(`Formato non supportato. File consentiti: ${accept}`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (validateFile(selectedFile)) {
      onFileSelect(selectedFile);
    } else {
      e.target.value = null; // reset input
      onFileSelect(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        onFileSelect(selectedFile);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeFile = (e) => {
    e.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = null;
    onFileSelect(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[12px] font-semibold text-slate-50 flex items-start gap-1 min-h-[36px]">
        <span>{label}</span> <span className="font-normal text-slate-400 ml-auto whitespace-nowrap">{helpText}</span>
      </label>

      <div 
        className={`relative border-2 border-dashed rounded-lg p-5 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[100px]
          ${isDragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/50 hover:border-indigo-400 hover:bg-indigo-500/20/50'}
          ${error ? 'border-red-400 bg-red-500/10' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
      >
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          accept={accept} 
          onChange={handleFileChange}
        />

        {!file ? (
          <>
            <UploadCloud className={`w-5 h-5 mb-1 ${error ? 'text-red-500' : 'text-indigo-400'}`} />
            <div className={`text-[12.5px] ${error ? 'text-red-400' : 'text-slate-400'}`}>
              {error ? error : (
                <>Trascina qui o <b className="text-indigo-400">clicca per sfogliare</b></>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-indigo-300">{file.name}</span>
            <button 
              type="button"
              onClick={removeFile}
              className="text-slate-400 hover:text-red-500 transition-colors ml-2"
              title="Rimuovi file"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
