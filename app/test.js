const fs = require('fs');
const appCode = fs.readFileSync('./src/App.tsx', 'utf8');

const matches = [...appCode.matchAll(/sm\.home === "([^"]+)" && sm\.away === "([^"]+)"\) \{\s*homeScore = (\d+); awayScore = (\d+);/g)];

const points = {};
matches.forEach(m => {
  const home = m[1];
  const away = m[2];
  const homeScore = parseInt(m[3]);
  const awayScore = parseInt(m[4]);
  
  if (!points[home]) points[home] = 0;
  if (!points[away]) points[away] = 0;
  
  if (homeScore > awayScore) {
    points[home] += 3;
  } else if (awayScore > homeScore) {
    points[away] += 3;
  } else {
    points[home] += 1;
    points[away] += 1;
  }
});

const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]);
console.log(sorted.slice(0, 6));
