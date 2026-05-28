const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

const colors = data.match(/(bg|text|border|from|via|to|shadow)-blue-\d{3}(\/\d\d)?/g);
if (colors) {
    const unique = [...new Set(colors)];
    console.log(unique.join('\n'));
} else {
    console.log('No matches');
}
