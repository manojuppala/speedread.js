#!/usr/bin/env node
//
// speedread:  A simple terminal-based open source spritz-alike
//
// Show input text as a per-word RSVP (rapid serial visual presentation)
// aligned on optimal reading points.  This kind of input mode allows
// reading text at a much more rapid pace than usual as the eye can
// stay fixed on a single place.
//
// MIT License
// Copyright (c) 2026 Manoj Uppala
//
// Usage: cat file.txt | speedread [-w WORDSPERMINUTE] [-r RESUMEPOINT] [-m]

const readline = require('readline');
const chalk = require('chalk');
const fs = require('fs');

// Parse command line arguments
let wpm = 250;
let resume = 0;
let multiword = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '-w' || args[i] === '--wpm') && args[i + 1]) {
    wpm = parseInt(args[i + 1]);
    i++;
  } else if ((args[i] === '-r' || args[i] === '--resume') && args[i + 1]) {
    resume = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '-m' || args[i] === '--multiword') {
    multiword = true;
  }
}

// Timing constants
const wordtime = 0.9;
const lentime = 0.04;
const commatime = 2;
const fstoptime = 3;
const multitime = 1.2;
const firsttime = 0.2;
const ORPvisualpos = 20;
const cursorpos = 64;

// State variables
let paused = false;
let currentWord = '';
let currentOrp = 0;
let nextWordTime = 0;
let nextInputTime = 0;
let skipped = 0;
let wordCounter = 0;
let letterCounter = 0;
const lastLines = [];
const startTime = Date.now();

// Find Optical Recognition Point
function findORP(word) {
  const len = word.length;
  if (len > 13) return 4;
  const orpMap = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];
  return orpMap[len] || 0;
}

// Calculate display time for a word
function wordTime(word) {
  let time = wordtime;
  
  if (/[.?!]\s*$/.test(word)) {
    time = fstoptime;
  } else if (/[:;,]\s*$/.test(word)) {
    time = commatime;
  } else if (/ /.test(word)) {
    time = multitime;
  }
  
  time += Math.sqrt(word.length) * lentime;
  time *= 60 / wpm;
  
  // Give user some time to focus on the first word
  if (wordCounter === 0 && time < firsttime) {
    time = firsttime;
  }
  
  return time;
}

// Show visual guide
function showGuide() {
  console.log(' '.repeat(ORPvisualpos) + chalk.red('v') + '\x1b[K');
}

// Show word with ORP highlighting
function showWord(word, i) {
  let pivotch = word[i] || '';
  if (pivotch === ' ') pivotch = '·';
  
  const prefix = word.substring(0, i);
  const suffix = word.substring(i + 1);
  
  const padding = ' '.repeat(ORPvisualpos - i);
  const endPadding = ' '.repeat(Math.max(0, cursorpos - ((ORPvisualpos - i) + word.length)));
  
  const status = `${wpm} wpm` + (paused ? '  ' + chalk.yellow('PAUSED') : '');
  
  process.stdout.write('\r\x1b[K' + padding + chalk.bold(prefix) + chalk.red.bold(pivotch) + 
                       chalk.bold(suffix) + endPadding + status);
}

// Print context when paused
function printContext(wn) {
  // Move up one line and clear
  process.stdout.write('\r\x1b[K\x1b[A\x1b[K');
  
  // First line of context
  if (lastLines[1]) {
    console.log(lastLines[1]);
  }
  
  // Second line with highlighted word
  if (lastLines[0]) {
    let line0 = lastLines[0];
    const regex = new RegExp(`^((?:.*?(?:-|\\s)+){${wn}})(.*?)(-|\\s)`);
    line0 = line0.replace(regex, `$1${chalk.yellow('$2')}$3`);
    console.log(line0);
  }
}

// Print statistics
function printStats() {
  const elapsed = (Date.now() - startTime) / 1000;
  const trueWpm = wordCounter / elapsed * 60;
  console.log(`\n ${elapsed.toFixed(2)}s, ${wordCounter} words, ${letterCounter} letters, ` +
              chalk.bold.green(`${trueWpm.toFixed(2)}`) + ' true wpm');
}

// Setup raw terminal input for keyboard controls
const tty = require('tty');
let ttyFd = null;
let isRawMode = false;

function setupRawMode() {
  try {
    // Try to open /dev/tty for keyboard input
    ttyFd = fs.openSync('/dev/tty', 'r');
    const ttyReadStream = new tty.ReadStream(ttyFd);
    readline.emitKeypressEvents(ttyReadStream);
    ttyReadStream.setRawMode(true);
    isRawMode = true;

    // Set up keypress handling
    ttyReadStream.on('keypress', (str, key) => {
      if (key && key.name === 'c' && key.ctrl) {
        cleanup();
      } else if (str === '[') {
        wpm = Math.floor(wpm * 0.9);
      } else if (str === ']') {
        wpm = Math.floor(wpm * 1.1);
      } else if (str === ' ') {
        paused = !paused;
        if (paused) {
          printContext(currentWn);
          showGuide();
          showWord(currentWord, currentOrp);
        } else {
          nextWordTime = Date.now() / 1000;
        }
      }
    });
  } catch (err) {
    // If we can't open /dev/tty, keyboard controls won't work
    // but the app can still function with piped input
  }
}

// Cleanup on exit
function cleanup() {
  if (isRawMode && ttyFd !== null) {
    try {
      // Reset terminal mode using stty
      const { execSync } = require('child_process');
      execSync('stty sane < /dev/tty', { stdio: 'ignore' });
    } catch (err) {
      // Ignore errors
    }
  }

  printStats();
  const resumeWord = wordCounter + resume;
  console.log(` To resume from this point run with argument -r ${resumeWord}`);
  process.exit(0);
}

process.on('SIGINT', cleanup);

// Track current word number for context
let currentWn = 0;

// Process a line of text
function processWords(words) {
  return new Promise((resolve) => {
    if (multiword) {
      // Join adjacent short words
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].length <= 3 && words[i + 1].length <= 3) {
          words[i] = words[i] + ' ' + words[i + 1];
          words.splice(i + 1, 1);
        }
      }
    }

    let wn = 0;
    let wordIndex = 0;

    const processNextWord = () => {
      if (wordIndex >= words.length) {
        resolve();
        return;
      }

      if (skipped < resume) {
        skipped++;
        wordIndex++;
        setImmediate(processNextWord);
        return;
      }

      const currentTime = Date.now() / 1000;

      if (nextWordTime <= currentTime && !paused) {
        currentWord = words[wordIndex];
        currentOrp = findORP(currentWord);
        nextWordTime += wordTime(currentWord);
        wordCounter++;
        letterCounter += currentWord.length;
        wn++;
        currentWn = wn;
        wordIndex++;
      }

      if (nextInputTime <= currentTime) {
        nextInputTime += 0.05;
      }

      // Redraw word
      showWord(currentWord, currentOrp);

      const sleepTime = (nextWordTime < nextInputTime && !paused)
        ? nextWordTime - currentTime
        : nextInputTime - currentTime;

      if (sleepTime > 0) {
        setTimeout(processNextWord, sleepTime * 1000);
      } else {
        setImmediate(processNextWord);
      }
    };

    processNextWord();
  });
}

// Main function
async function main() {
  setupRawMode();
  showGuide();

  nextWordTime = Date.now() / 1000;
  nextInputTime = Date.now() / 1000;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const lines = [];

  // Collect all lines first
  for await (const line of rl) {
    lines.push(line);
  }

  // Close the readline interface
  rl.close();

  // Process each line
  for (const line of lines) {
    lastLines.unshift(line);
    if (lastLines.length > 2) {
      lastLines.pop();
    }

    const words = line.split(/(?:-|\s)+/).filter(w => w.length > 0);

    if (words.length > 0) {
      await processWords(words);
    }
  }

  setTimeout(() => {
    cleanup();
  }, 1000);
}

main().catch(err => {
  console.error(err);
  cleanup();
});
