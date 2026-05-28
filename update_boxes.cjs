const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/rounded-\[12px\]/g, 'rounded-sm');
data = data.replace(/rounded-\[8px\]/g, 'rounded-sm');
data = data.replace(/rounded-\[6px\]/g, 'rounded-sm');
data = data.replace(/rounded-\[4px\]/g, 'rounded-sm');

fs.writeFileSync(file, data);
console.log('done squaring');
