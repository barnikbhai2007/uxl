import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');
const words = data.match(/font-[a-zA-Z0-9-]+/g) || [];
const unq = Array.from(new Set(words));
console.log(unq);
