const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/bg-\[#000030\]/g, 'bg-fc-purple-dark');
data = data.replace(/bg-\[#000040\]/g, 'bg-fc-purple-base');
data = data.replace(/bg-\[#0a0a1a\]/g, 'bg-fc-purple-base');
data = data.replace(/bg-\[#00000a\]/g, 'bg-fc-purple-dark');
data = data.replace(/from-\[#000030\]/g, 'from-fc-purple-dark');
data = data.replace(/to-blue-900\/20/g, 'to-fc-purple-base/50');
data = data.replace(/to-blue-900/g, 'to-fc-purple-base');

fs.writeFileSync(file, data);
console.log('done replacing hex');
