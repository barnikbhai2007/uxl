const fs = require('fs');
const file = 'src/App.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-100(\/\d\d)?/g, '$1-white');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-200(\/\d\d)?/g, '$1-fc-neon-green$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-300(\/\d\d)?/g, '$1-fc-neon-green$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-400(\/\d\d)?/g, '$1-fc-neon-green$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-500(\/\d\d)?/g, '$1-fc-purple-light$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-600(\/\d\d)?/g, '$1-fc-purple-base$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-700(\/\d\d)?/g, '$1-fc-purple-base$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-800(\/\d\d)?/g, '$1-fc-purple-dark$3');
data = data.replace(/([a-z]+)-(indigo|cyan|violet|purple)-900(\/\d\d)?/g, '$1-fc-purple-dark$3');

fs.writeFileSync(file, data);
console.log('done replacing other colors');
