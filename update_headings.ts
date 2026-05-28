import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// replace <h1>, <h2>, <h3>, <h4> classNames to include font-display if not there
content = content.replace(/<(h[1-6])[^>]*className="([^"]+)"/g, (match, tag, classes) => {
    if (!classes.includes('font-display')) {
        return `<${tag} className="font-display ${classes.replace(/font-(sans|mono)\s*/g, '')}"`;
    }
    return match;
});

// Change primary buttons to green #00FF87 with dark text 
// Let's replace 'bg-fc-neon-green text-white' just in case. Wait, it is usually text-black.
content = content.replace(/bg-fc-neon-green(\/10|\/20|\/30|\/40|\/50|\/60|\/70|\/80|\/90)?/g, (match) => {
    return match; // don't change this, background is green
});

// "Change all active/selected states to gold border glow"
// activeTab === '...' ? '... shadow-fc-neon-green/20' ...
// we can replace `shadow-fc-neon-green` with `shadow-fc-gold` when it's an active tab condition.
content = content.replace(/activeTab === '[^']+' \? '[^']+bg-fc-neon-green[^']+' : '[^']+'/g, (match) => {
    // If it's a tab selection, change its background to gold instead of neon-green? Or border?
    // User says: "Change all active/selected states to gold border glow"
    // So if it's active: border-fc-gold shadow-[0_0_15px_rgba(255,215,0,0.5)] ?
    return match.replace(/shadow-fc-neon-green/g, 'shadow-fc-gold').replace(/bg-fc-neon-green text-black text-black/g, 'bg-fc-purple-dark text-fc-gold border border-fc-gold/50');
});

// What about campaignTab?
content = content.replace(/campaignTab === '[^']+' \? '[^']+'/g, (match) => {
    return match.replace(/shadow-fc-neon-green/g, 'shadow-fc-gold').replace(/bg-fc-neon-green text-black/g, 'bg-fc-purple-dark text-fc-gold border border-fc-gold/50');
});

// Also border glow on hover borders:
// Replace some active things inside bracket
content = content.replace(/border-fc-neon-green\/50/g, 'border-fc-gold/50');

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log("App.tsx tab/headings replacements done.");
