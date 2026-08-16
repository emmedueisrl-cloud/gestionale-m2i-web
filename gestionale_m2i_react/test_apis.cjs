const fs = require('fs');
const path = require('path');

const apiDir = './src/api';
const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
let apiCallsFrontend = new Set();

files.forEach(f => {
    const content = fs.readFileSync(path.join(apiDir, f), 'utf8');
    const regex = /apiCall\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        apiCallsFrontend.add(match[1]);
    }
});

console.log(JSON.stringify(Array.from(apiCallsFrontend).sort()));
