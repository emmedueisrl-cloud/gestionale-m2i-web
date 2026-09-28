export function attachmentUrl(filePath, baseUrl = import.meta.env?.VITE_API_URL || '') {
  return `${baseUrl.replace(/\/+$/, '')}/${String(filePath || '').replace(/^\/+/, '')}`;
}
