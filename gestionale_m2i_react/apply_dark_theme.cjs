const fs = require('fs');
const path = require('path');

const directory = './src';

// Mappa di sostituzione classi Tailwind: Light -> Dark
const replacements = [
  // Sfondi
  { from: /bg-slate-50/g, to: 'bg-slate-900/50' },
  { from: /bg-white/g, to: 'bg-slate-800' },
  { from: /bg-white\/50/g, to: 'bg-slate-800/50' },
  { from: /bg-white\/70/g, to: 'bg-slate-800/70' },
  
  // Testi
  { from: /text-slate-800/g, to: 'text-slate-50' },
  { from: /text-slate-700/g, to: 'text-slate-200' },
  { from: /text-slate-600/g, to: 'text-slate-300' },
  { from: /text-slate-500/g, to: 'text-slate-400' },
  
  // Bordi
  { from: /border-slate-200/g, to: 'border-slate-700' },
  { from: /border-slate-300/g, to: 'border-slate-600' },
  { from: /border-slate-100/g, to: 'border-slate-800' },
  
  // Hover sfondi
  { from: /hover:bg-slate-50/g, to: 'hover:bg-slate-700/50' },
  { from: /hover:bg-slate-100/g, to: 'hover:bg-slate-700' },
  { from: /hover:bg-slate-200/g, to: 'hover:bg-slate-600' },
  
  // Indigo (Primary) - rendiamo un po' più luminosi su sfondo scuro
  //bg-indigo-50 -> bg-indigo-900/30
  { from: /bg-indigo-50/g, to: 'bg-indigo-500/10' },
  { from: /bg-indigo-100/g, to: 'bg-indigo-500/20' },
  { from: /text-indigo-600/g, to: 'text-indigo-400' },
  { from: /text-indigo-700/g, to: 'text-indigo-300' },
  { from: /border-indigo-100/g, to: 'border-indigo-500/30' },
  { from: /border-indigo-200/g, to: 'border-indigo-500/50' },
  { from: /hover:bg-indigo-50/g, to: 'hover:bg-indigo-500/20' },
  { from: /hover:text-indigo-600/g, to: 'hover:text-indigo-400' },
  
  // Emerald (Secondary)
  { from: /bg-emerald-50/g, to: 'bg-emerald-500/10' },
  { from: /bg-emerald-100/g, to: 'bg-emerald-500/20' },
  { from: /text-emerald-600/g, to: 'text-emerald-400' },
  { from: /text-emerald-700/g, to: 'text-emerald-300' },
  { from: /border-emerald-200/g, to: 'border-emerald-500/50' },
  { from: /hover:bg-emerald-50/g, to: 'hover:bg-emerald-500/20' },
  
  // Amber / Orange / Red (Alerts)
  { from: /bg-amber-50/g, to: 'bg-amber-500/10' },
  { from: /bg-amber-100/g, to: 'bg-amber-500/20' },
  { from: /text-amber-600/g, to: 'text-amber-400' },
  { from: /text-amber-700/g, to: 'text-amber-300' },
  
  { from: /bg-red-50/g, to: 'bg-red-500/10' },
  { from: /bg-red-100/g, to: 'bg-red-500/20' },
  { from: /text-red-600/g, to: 'text-red-400' },
  { from: /text-red-700/g, to: 'text-red-300' },
  { from: /hover:bg-red-50/g, to: 'hover:bg-red-500/20' },
  
  // Violet
  { from: /bg-violet-50/g, to: 'bg-violet-500/10' },
  { from: /bg-violet-100/g, to: 'bg-violet-500/20' },
  { from: /text-violet-600/g, to: 'text-violet-400' },
  { from: /text-violet-700/g, to: 'text-violet-300' },
  { from: /border-violet-200/g, to: 'border-violet-500/50' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  replacements.forEach(rep => {
    newContent = newContent.replace(rep.from, rep.to);
  });
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

processDirectory(directory);
console.log('Restyling Dark Theme applicato.');
