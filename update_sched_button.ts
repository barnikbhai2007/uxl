import * as fs from 'fs';
const data = fs.readFileSync('src/ScheduleRandomizer.tsx', 'utf-8');

// The generate schedule button had bg-fc-neon-green text-black, wait, it has hover:bg-fc-purple-light. 
// We don't want it to turn purple on hover, we can make it hover:bg-fc-neon-green-dark
// And all buttons with bg-fc-neon-green should be text-black. We already did this via update_glow.ts but let me ensure.
let newData = data.replace(/bg-fc-neon-green/g, 'bg-fc-neon-green text-black');
// deduplicate text-black text-black
newData = newData.replace(/text-black text-black/g, 'text-black');

newData = newData.replace(/hover:bg-fc-purple-light/g, 'hover:bg-fc-neon-green-dark');

fs.writeFileSync('src/ScheduleRandomizer.tsx', newData, 'utf-8');
console.log("Randomizer button styles fixed");
