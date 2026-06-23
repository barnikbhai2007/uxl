const fs = require('fs');
const lines = fs.readFileSync('src/constants.ts', 'utf8').split('\n');

const names = [];
const flags = [];
lines.forEach(l => {
  if (l.includes('name:')) {
    const m = l.match(/name:\s*'([^']+)'/);
    if (m) names.push(m[1]);
  }
  if (l.includes('flag:')) {
    const m = l.match(/flag:\s*'([^']+)'/);
    if (m) flags.push(m[1]);
  }
});

const dups = names.filter((e, i, a) => a.indexOf(e) !== i);
console.log('Duplicate names:', dups);

const dups2 = flags.filter((e, i, a) => a.indexOf(e) !== i);
console.log('Duplicate flags:', dups2);
