const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/rounded-\[2\.5rem\]/g, 'rounded-[12px]');
data = data.replace(/rounded-\[1\.5rem\]/g, 'rounded-[8px]');
data = data.replace(/rounded-full/g, 'rounded-[4px]');

fs.writeFileSync(file, data);
console.log('done replacing super rounding');
