const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist');
const OUT = path.join(ROOT, 'dist', 'JiraTimeline');
const APP = path.join(OUT, 'resources', 'app');
const { version } = require('./package.json');

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

function step(msg) { process.stdout.write(`  • ${msg}\n`); }

console.log('\nJira Timelog Tool — build\n');

step('Cleaning dist…');
rimraf(OUT);
fs.mkdirSync(path.join(APP, 'node_modules', 'xlsx'), { recursive: true });

step('Copying Electron runtime…');
copyDir(ELECTRON, OUT);

step('Renaming executable…');
fs.renameSync(
  path.join(OUT, 'electron.exe'),
  path.join(OUT, 'Jira Timelog Tool.exe')
);

step('Copying app source…');
fs.copyFileSync(path.join(ROOT, 'main.js'), path.join(APP, 'main.js'));
fs.copyFileSync(path.join(ROOT, 'preload.js'), path.join(APP, 'preload.js'));
copyDir(path.join(ROOT, 'src'), path.join(APP, 'src'));
copyDir(path.join(ROOT, 'renderer'), path.join(APP, 'renderer'));
fs.writeFileSync(
  path.join(APP, 'package.json'),
  JSON.stringify({ name: 'jira-timelog-tool', version, main: 'main.js' }, null, 2)
);

step('Copying production dependencies (xlsx)…');
copyDir(
  path.join(ROOT, 'node_modules', 'xlsx'),
  path.join(APP, 'node_modules', 'xlsx')
);

const mb = (dirSize(OUT) / 1024 / 1024).toFixed(1);
console.log(`\n Done — ${mb} MB\n  -> ${OUT}\n`);
