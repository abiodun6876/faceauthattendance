const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Dashboard.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix all setDebugInfo calls
content = content.replace(/setDebugInfo\(prev =>/g, 'setDebugInfo((prev: any) =>');

// Write back to file
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed all TypeScript errors in Dashboard.tsx');
console.log('Fixed', (content.match(/setDebugInfo\(\(prev: any\) =>/g) || []).length, 'instances');