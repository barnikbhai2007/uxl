import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace shadow from blue to gold on the nav-pill
let newData = data.replace(/shadow-\[0_0_20px_rgba\(96,165,250,0\.15\)\] border border-fc-neon-green\/20/g, 'shadow-[0_0_20px_rgba(255,215,0,0.2)] border border-fc-gold/50');
newData = newData.replace(/shadow-\[0_10px_30px_rgba\(37,99,235,0\.4\)\]/g, 'shadow-[0_10px_30px_rgba(255,215,0,0.3)]'); // Join Tournament button shadow

// Let's make sure the Trophy is gold?
newData = newData.replace(/text-fc-neon-green drop-shadow-\[0_0_15px_rgba\(96,165,250,0\.5\)\]/g, 'text-fc-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]');


fs.writeFileSync('src/App.tsx', newData, 'utf-8');
console.log("Updated active layouts to gold border glow.");
