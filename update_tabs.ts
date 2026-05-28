import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace active tab generic styles
let newData = data.replace(/bg-fc-neon-green text-black text-black shadow-lg shadow-fc-gold\/([0-9]+)/g, 'bg-fc-purple-dark text-fc-gold border border-fc-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.3)]');

// Replace standard active tab logic for main UI (like 'campaignTab === ...')
newData = newData.replace(/bg-fc-neon-green text-black text-black shadow-lg shadow-fc-gold\/40/g, 'bg-fc-purple-dark text-fc-gold border border-fc-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.3)]');
// If there are other variants, just fix `bg-fc-neon-green` where it represents an active tab state:
// Looking at lines like: `activeTab === 'bracket' ? 'bg-fc-purple-dark text-fc-gold border...'
newData = newData.replace(/bg-fc-neon-green text-black shadow-lg/g, 'bg-fc-purple-dark text-fc-gold border border-fc-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.3)]');

fs.writeFileSync('src/App.tsx', newData, 'utf-8');
console.log("Updated active tabs to gold border glow.");
