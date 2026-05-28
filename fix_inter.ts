import * as fs from 'fs';
const data = fs.readFileSync('src/App.tsx', 'utf-8');
const newData = data.replace(/style=\{\{ fontFamily: "'Inter', sans-serif" \}\}/g, 'style={{ fontFamily: "\'Barlow Condensed\', sans-serif" }}');
fs.writeFileSync('src/App.tsx', newData, 'utf-8');
