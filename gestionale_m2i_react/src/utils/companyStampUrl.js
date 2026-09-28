export function companyStampUrl(value) {
  if (typeof value !== 'string') return null;
  const relative = value.replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = relative.split('/');
  if (segments[0] !== 'uploads' || segments.length < 3 || segments.some(part => !part || part === '.' || part === '..')) return null;
  return `/${segments.map(encodeURIComponent).join('/')}`;
}
