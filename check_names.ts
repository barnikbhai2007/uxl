import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');
console.log("UXI Tournament count:", (data.match(/UXI Tournament/g) || []).length);
console.log("Elite Competition count:", (data.match(/Elite Competition/gi) || []).length);
console.log("WORLD'S GAME count:", (data.match(/THE WORLD'S GAME/g) || []).length);
