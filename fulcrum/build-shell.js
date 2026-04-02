#!/usr/bin/env node
// Assembles shell.json from blocks/*.json
// blocks/ is truth — shell.json is a build artifact.

const fs = require('fs');
const path = require('path');

const blocksDir = path.join(__dirname, 'blocks');
const outFile = path.join(__dirname, 'shell.json');

const shell = { blocks: {} };

const files = fs.readdirSync(blocksDir)
  .filter(f => f.endsWith('.json'))
  .sort();

for (const file of files) {
  const name = file.replace('.json', '');
  shell.blocks[name] = JSON.parse(fs.readFileSync(path.join(blocksDir, file), 'utf8'));
}

fs.writeFileSync(outFile, JSON.stringify(shell, null, 2) + '\n');
console.log(`shell.json assembled from ${files.length} blocks: ${files.map(f => f.replace('.json','')).join(', ')}`);
