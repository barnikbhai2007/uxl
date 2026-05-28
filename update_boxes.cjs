const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

// The FC Mobile theme is more squarish, so let's tone down the rounding
data = data.replace(/rounded-3xl/g, 'rounded-[12px]');
data = data.replace(/rounded-2xl/g, 'rounded-[8px]');
data = data.replace(/rounded-xl/g, 'rounded-[6px]');
data = data.replace(/rounded-lg/g, 'rounded-[4px]');

// Ensure text on neon green buttons is black
data = data.replace(/bg-fc-neon-green text-white/g, 'bg-fc-neon-green text-black');

fs.writeFileSync(file, data);
console.log('done');
