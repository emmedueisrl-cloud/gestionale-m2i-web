export const codiceFiscaleClienteValido = value =>
  /^(?:\d{11}|[A-Z0-9]{16})$/i.test(String(value || '').trim());
