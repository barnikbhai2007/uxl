const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

// replace the remaining blue shades with appropriate purple/green shades
data = data.replace(/([a-z]+)-blue-100(\/\d\d)?/g, '$1-white');
data = data.replace(/([a-z]+)-blue-200(\/\d\d)?/g, '$1-fc-neon-green$2');
data = data.replace(/([a-z]+)-blue-300(\/\d\d)?/g, '$1-fc-neon-green$2');
data = data.replace(/([a-z]+)-blue-400(\/\d\d)?/g, '$1-fc-neon-green$2');
data = data.replace(/([a-z]+)-blue-500(\/\d\d)?/g, '$1-fc-neon-green$2');
data = data.replace(/([a-z]+)-blue-600(\/\d\d)?/g, '$1-fc-neon-green$2');
data = data.replace(/([a-z]+)-blue-700(\/\d\d)?/g, '$1-fc-purple-light$2');
data = data.replace(/([a-z]+)-blue-800(\/\d\d)?/g, '$1-fc-purple-base$2');
data = data.replace(/([a-z]+)-blue-900(\/\d\d)?/g, '$1-fc-purple-base$2');
data = data.replace(/([a-z]+)-blue-950(\/\d\d)?/g, '$1-fc-purple-dark$2');

// make sure text on bg-fc-neon-green is black
data = data.replace(/bg-fc-neon-green([^"']*?)text-white/g, 'bg-fc-neon-green$1text-black');

fs.writeFileSync(file, data);
console.log('done replacing blues');
