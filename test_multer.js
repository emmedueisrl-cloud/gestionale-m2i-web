const path = require('path');
const file = { originalname: 'Il Mio Bellissimo Contratto!_ 2026.pdf' };
const req = {};

// Logica esportata o copiata dal server.js
const originalName = file.originalname || 'documento';
let safeName = originalName.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim();
if (!safeName) safeName = 'doc_' + Date.now();

console.log('Nome originale:', originalName);
console.log('Nome sanificato:', safeName);
