import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// The user asked to rename "Elite Competition" and any app title to "THE WORLD'S GAME" everywhere in App.tsx
content = content.replace(/UXI Tournament/g, "THE WORLD'S GAME");
content = content.replace(/Elite Competition/gi, "THE WORLD'S GAME");
content = content.replace(/defaultText="Tournament"/g, 'defaultText="THE WORLD\'S GAME"');
content = content.replace(/alt="Tournament Registration"/g, 'alt="THE WORLD\'S GAME Registration"');
content = content.replace(/"Tournament Registration"/g, '"THE WORLD\'S GAME Registration"');

// 5. Change all primary buttons to green #00FF87 with dark text 
// (bg-fc-neon-green text-black is our mapping since neon-green is #00FF87)
// It was bg-fc-neon-green text-black before, maybe we need to make sure text is black

// 6. Change all active/selected states to gold border glow
// Replace hover:border-fc-neon-green/50 with hover:border-fc-gold/50 ? Or border-fc-neon-green/50 with border-fc-gold/50 ?
// "Change all active/selected states to gold border glow" ->
// We should probably replace some shadow-fc-neon-green/20, border-fc-neon-green/50 with gold on active states.

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log("App.tsx text replacements done.");
