import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = data.split('\n');
[2937, 3477, 3487, 3501, 3504, 3632, 3635, 6560].forEach(n => console.log(lines[n]));
