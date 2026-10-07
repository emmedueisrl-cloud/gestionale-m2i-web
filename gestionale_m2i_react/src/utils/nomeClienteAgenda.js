export function nomeClienteAgenda(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 3).join(' ');
}
