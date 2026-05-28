const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');
const matches = data.match(/className="[^"]*#[0-9a-fA-F]+[^"]*"/g);
if (matches) {
    console.log(matches.slice(0, 10).join('\n'));
} else {
    console.log('No matches');
}
