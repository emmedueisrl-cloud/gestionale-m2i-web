import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle, XCircle } from 'lucide-react';

export default function FileUploader({ 
  label, 
  helpText = "- Max 10MB", 
  accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png", 
  maxSizeMB = 10,
  onFileSelect,
  file, // can be single file or array of files
  multiple = false
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (selectedFile) => {
    if (!selectedFile) return false;

    // Check size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`Il file ${selectedFile.name} è troppo grande. Max: ${maxSizeMB}MB`);
      return false;
    }

    // Check extension
    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    const acceptedTypes = accept.split(',').map(e => e.trim());
    if (!acceptedTypes.includes(ext)) {
      setError(`Formato non supportato per ${selectedFile.name}. File consentiti: ${accept}`);
      return false;
    }

    return true;
  };

  const processFiles = (fileList) => {
    setError(null);
    const filesArray = Array.from(fileList);
    
    if (multiple) {
      const validFiles = filesArray.filter(validateFile);
      if (validFiles.length > 0) {
        // If there were already files, append them
        const existingFiles = Array.isArray(file) ? file : (file ? [file] : []);
        onFileSelect([...existingFiles, ...validFiles]);
      }
    } else {
      const selectedFile = filesArray[0];
      if (validateFile(selectedFile)) {
        onFileSelect(selectedFile);
      } else {
        if (fileInputRef.current) fileInputRef.current.value = null;
        onFileSelect(null);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
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

  const removeFile = (e, indexToRemove = null) => {
    e.stopPropagation();
    setError(null);
    
    if (multiple && Array.isArray(file)) {
      const newFiles = file.filter((_, idx) => idx !== indexToRemove);
      onFileSelect(newFiles.length > 0 ? newFiles : null);
    } else {
      if (fileInputRef.current) fileInputRef.current.value = null;
      onFileSelect(null);
    }
  };

  const hasFiles = multiple ? (Array.isArray(file) && file.length > 0) : !!file;
  const filesList = multiple ? (Array.isArray(file) ? file : (file ? [file] : [])) : (file ? [file] : []);

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
          multiple={multiple}
          onChange={handleFileChange}
        />

        {!hasFiles ? (
          <>
            <UploadCloud className={`w-5 h-5 mb-1 ${error ? 'text-red-500' : 'text-indigo-400'}`} />
            <div className={`text-[12.5px] ${error ? 'text-red-400' : 'text-slate-400'}`}>
              {error ? error : (
                <>Trascina qui o <b className="text-indigo-400">clicca per sfogliare</b></>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 w-full text-sm">
            {filesList.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between w-full bg-slate-800/80 px-3 py-1.5 rounded border border-slate-700">
                <div className="flex items-center gap-2 overflow-hidden">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="font-semibold text-indigo-300 truncate text-left">{f.name}</span>
                </div>
                <button 
                  type="button"
                  onClick={(e) => removeFile(e, idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                  title="Rimuovi file"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {multiple && (
              <div className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                + Clicca per aggiungere altri file
              </div>
            )}
            {error && <div className="text-[12.5px] text-red-400 mt-1">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
