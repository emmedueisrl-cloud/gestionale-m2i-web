const fs = require('fs');
let content = fs.readFileSync('src/pages/Commerciale/Fatture.jsx', 'utf8');

const targetStr = `{ 
      header: 'Imponibile',`;

const replaceStr = `{ 
      header: 'Causale (XML)', 
      accessor: 'note',
      render: (row) => <div className="max-w-[200px] truncate text-xs" title={row.note}>{row.note || '-'}</div>
    },
    { 
      header: 'Imponibile',`;
      
content = content.replace(targetStr, replaceStr);
fs.writeFileSync('src/pages/Commerciale/Fatture.jsx', content);
