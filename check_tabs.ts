import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');

// Searching for tab active classes
const lines = data.split('\n');
const activeTabs = lines.filter(l => l.includes("activeTab ==="));
console.log(activeTabs.slice(0, 15).join('\n'));
