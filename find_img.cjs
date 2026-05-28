const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

const matches = data.match(/<img[^>]*>/g);
if (matches) {
    console.log(matches.join('\n'));
} else {
    console.log('No matches');
}
