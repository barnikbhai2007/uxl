import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');

// The active tab glow and border
let newData = data.replace(/shadow-lg shadow-fc-neon-green\/([0-9]+)/g, 'shadow-lg shadow-fc-gold/$1');
newData = newData.replace(/shadow-xl shadow-fc-neon-green\/([0-9]+)/g, 'shadow-xl shadow-fc-gold/$1');
newData = newData.replace(/shadow-2xl shadow-fc-neon-green\/([0-9]+)/g, 'shadow-2xl shadow-fc-gold/$1');

// Hover borders to gold inside bracket and schedule randomizer, etc.
newData = newData.replace(/hover:border-fc-neon-green/g, 'hover:border-fc-gold');
newData = newData.replace(/focus:border-fc-neon-green/g, 'focus:border-fc-gold');

// Check the ScheduleRandomizer glow as well
if (fs.existsSync('src/ScheduleRandomizer.tsx')) {
   let schedData = fs.readFileSync('src/ScheduleRandomizer.tsx', 'utf-8');
   schedData = schedData.replace(/shadow-fc-neon-green/g, 'shadow-fc-gold');
   schedData = schedData.replace(/hover:border-fc-neon-green/g, 'hover:border-fc-gold');
   schedData = schedData.replace(/focus:border-fc-neon-green/g, 'focus:border-fc-gold');
   // change its buttons
   schedData = schedData.replace(/bg-fc-neon-green/g, 'bg-fc-neon-green text-black');
   fs.writeFileSync('src/ScheduleRandomizer.tsx', schedData, 'utf-8');
}

fs.writeFileSync('src/App.tsx', newData, 'utf-8');
console.log("Updated glow states");
