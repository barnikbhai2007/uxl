const fs = require('fs');

let content = fs.readFileSync('src/constants.ts', 'utf8');

let index = 1;
content = content.replace(/photoUrl:\s*'[^']+'/g, (match) => {
  const newMatch = `photoUrl: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Manager${index}&backgroundColor=b6e3f4,c0aede,d1d4f9'`;
  index++;
  return newMatch;
});

fs.writeFileSync('src/constants.ts', content, 'utf8');
