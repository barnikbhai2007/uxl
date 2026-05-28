import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf8');
const lines = data.split('\n');
lines.forEach((line, i) => {
  if (line.includes('fc-') && line.includes('${')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
