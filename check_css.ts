import * as fs from 'fs';
import * as path from 'path';

const distAssets = path.join(process.cwd(), 'dist', 'assets');
const files = fs.readdirSync(distAssets);
const cssFile = files.find(f => f.endsWith('.css'));

if (cssFile) {
  const css = fs.readFileSync(path.join(distAssets, cssFile), 'utf-8');
  console.log("Includes color variables?", css.includes('fc-purple-dark'));
  console.log("Includes bg-fc-purple-dark?", css.includes('bg-fc-purple-dark'));
  console.log("Includes bg-yellow-500/20?", css.includes('bg-yellow-500\\/20'));
} else {
  console.log("No css file");
}
