import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');

let newData = data.replace(/bg-fc-neon-green text-black hover:bg-fc-purple-light/g, 'bg-fc-neon-green text-black hover:bg-fc-neon-green-dark');
// Deduplicate text-black text-black just in case
newData = newData.replace(/text-black text-black/g, 'text-black');

fs.writeFileSync('src/App.tsx', newData, 'utf-8');
console.log("App.tsx button hovers fixed");
