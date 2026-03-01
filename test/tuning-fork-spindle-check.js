// Quick check: does the tuning-fork-spec.json read well as spindles?
const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('lib/tuning-fork-spec.json', 'utf8'));

function spindle(block, addr) {
  const digits = String(addr).replace('0.','').split('');
  let node = block.tree;
  const nodes = [{text: node._ || '(root)', depth: 0}];
  for (const d of digits) {
    if (node === null || node === undefined || typeof node !== 'object') break;
    if (node[d] === undefined) break;
    node = node[d];
    const text = typeof node === 'string' ? node : (node._ || '');
    nodes.push({text, depth: nodes.length});
  }
  return nodes;
}

console.log('=== Spindle 0.1: What it is ===');
spindle(spec, '0.1').forEach(n => console.log('  '.repeat(n.depth) + n.text.substring(0, 140)));

console.log('\n=== Spindle 0.21: Drift prevention ===');
spindle(spec, '0.21').forEach(n => console.log('  '.repeat(n.depth) + n.text.substring(0, 140)));

console.log('\n=== Spindle 0.4: Functions on tuning forks ===');
spindle(spec, '0.4').forEach(n => console.log('  '.repeat(n.depth) + n.text.substring(0, 140)));

console.log('\n=== Spindle 0.6: The triad ===');
spindle(spec, '0.6').forEach(n => console.log('  '.repeat(n.depth) + n.text.substring(0, 140)));

console.log('\n=== Spindle 0.53: Type 3 — Independent composition ===');
spindle(spec, '0.53').forEach(n => console.log('  '.repeat(n.depth) + n.text.substring(0, 140)));
