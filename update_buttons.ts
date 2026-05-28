import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = data.split('\n');
let modified = false;

for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes('bg-fc-neon-green')) {
       // if it doesn't have text-black, maybe add it
       if (!lines[i].includes('text-black')) {
           lines[i] = lines[i].replace(/bg-fc-neon-green/g, 'bg-fc-neon-green text-black');
           modified = true;
       }
   }
}

if (modified) {
   fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf-8');
   console.log("Added text-black to neon green backgrounds.");
}
