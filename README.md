# speedread.js

A simple terminal-based open source Spritz-alike for Node.js.

This command line filter shows input text as a per-word RSVP (rapid serial visual presentation) aligned on optimal reading points. This kind of input mode allows reading text at a much more rapid pace than usual as the eye can stay fixed on a single place.

## Installation

### Global Installation (Recommended)

Install globally to use the `speedread` command anywhere:

```bash
npm install -g speedread
```

or with yarn:

```bash
yarn global add speedread
```

Then use it directly:

```bash
cat document.txt | speedread -w 500
```

### Local Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/manojuppala/speedread.git
cd speedread
yarn install
```

## Basic Example

If installed globally:

```bash
cat document.txt | speedread -w 250
echo "Hello world" | speedread -w 300
```

If using locally:

```bash
cat test.txt | node speedread.js -w 250
# or
cat test.txt | ./speedread -w 250
```

**Note:** The included `test.txt` is an essay-style test file that provides an engaging reading experience while testing all features.

The default of 250 words per minute is very timid, designed so that you get used to this. Be sure to try cranking this up, 500wpm should still be fairly easy to follow even for beginners.

## Controls

speedread is slightly interactive, with these controls accepted:

- `[` - slow down by 10%
- `]` - speed up by 10%
- `space` - pause (and show the last two lines of context)
- `Ctrl+C` - quit and show statistics

## Command Line Options

- `-w, --wpm <number>` - Set words per minute (default: 250)
- `-r, --resume <number>` - Resume from a specific word number
- `-m, --multiword` - Join adjacent short words (experimental)

## Features

- **RSVP Display**: Shows one word at a time with optimal reading point (ORP) highlighted
- **Smart Timing**: Longer pauses at punctuation (commas, periods, etc.)
- **Length-based Timing**: Adjusts display time based on word length
- **Interactive Controls**: Adjust speed on the fly, pause to see context
- **Statistics**: Shows reading speed, word count, and elapsed time
- **Resume Support**: Can resume reading from a specific word
- **Context Display**: When paused, shows the last two lines with current word highlighted
- **UTF-8 Support**: Handles Unicode text properly

## How It Works

The program uses the concept of an Optimal Recognition Point (ORP) - a specific letter in each word that, when focused on, allows for the fastest reading. The ORP is typically around 35% into the word and is highlighted in red.

Words are displayed with timing that accounts for:

- Base word time
- Word length (longer words get more time)
- Punctuation (periods get 3x time, commas get 2x time)
- First word bonus (extra time to focus)

## Integration Examples

### With mutt email client

Add to your `~/.muttrc`:

```
macro pager R "<enter-command>set pipe_decode=yes<enter>v|grep -v '^>' | /path/to/speedread<enter><enter-command>unset pipe_decode<enter>q" "speedread"
```

Then press `R` when viewing a message.

### With any text file

```bash
cat document.txt | node speedread.js -w 500
```

### Resume reading

If you exit with Ctrl+C, the program will tell you the word number to resume from:

```bash
cat document.txt | node speedread.js -w 500 -r 150
```

## License

MIT License

Copyright (c) 2026 Manoj Uppala
