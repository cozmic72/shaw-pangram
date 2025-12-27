# Shavian Pangram & Anagram Solver

A web-based and command-line tool for finding perfect pangrams (using each letter exactly once) for the Shavian alphabet and solving general anagrams.

## Features

- **Pangram Solver**: Find perfect pangrams for the full 48-letter Shavian alphabet or custom letter sets
- **Anagram Solver**: Solve anagrams with specific letters
- **Web Interface**: Interactive UI with drag-and-drop result reordering and auto-pause
- **Command-line Interface**: Python script for batch processing
- **Customizable**:
  - Target letters (custom or full alphabet)
  - Starter words to reduce the problem space
  - Exclude specific words
  - Auto-pause after each batch for performance

## Setup

### Clone the Repository

```bash
git clone <repository-url>
cd pangram
git submodule update --init --recursive
```

This will clone the repository and fetch the readlex dictionary as a submodule.

## Usage

### Web Interface

1. **Start a local server** (required for loading the readlex.json file):

   ```bash
   # Python 3
   python3 -m http.server 8000

   # Or using Node.js
   npx http-server -p 8000
   ```

2. **Open in browser**: Navigate to `http://localhost:8000/index.html`

   The dictionary loads automatically on page load.

3. **Configure options** (all optional):
   - **Target Letters**: Leave empty for all 48 Shavian letters, or specify custom letters
   - **Starter Words**: Words to include (their letters are removed from the target)
   - **Exclude Words**: Words to exclude from results

4. **Solve**: Click "Solve" to start finding solutions
   - Results appear in real-time
   - Search pauses automatically every 50 solutions
   - Click "Resume" to continue or "Pause" to stop temporarily

5. **Drag & Drop**: Reorder results by dragging and dropping to build sentences

6. **Clear**: Reset all results and stats

### Command-line Interface

The Python script provides the same functionality via command line:

```bash
# Find pangrams for full Shavian alphabet
./shavian_pangram.py

# Find pangrams for a subset of letters
./shavian_pangram.py --letters "𐑐𐑑𐑒 𐑓𐑔𐑕"

# Use starter words
./shavian_pangram.py --starter-words "𐑐𐑑 𐑒𐑓"

# Exclude specific words (space or comma-separated)
./shavian_pangram.py --exclude-words "𐑐𐑑 𐑒𐑓 𐑔𐑕"
./shavian_pangram.py --exclude-words "𐑐𐑑,𐑒𐑓,𐑔𐑕"

# Exclude words by part-of-speech tag
./shavian_pangram.py --exclude-pos "n v"
./shavian_pangram.py --exclude-pos "n,v,adj"

# Limit solutions
./shavian_pangram.py --max 10

# Use custom readlex file
./shavian_pangram.py --readlex /path/to/readlex.json
```

## Algorithm

The solver uses a Trie-based backtracking algorithm optimized for pangram solving:

1. **Trie Construction**: Builds a Trie of all valid words using only target letters
2. **Letter Rarity Ordering**: Prioritizes rarest letters first to prune the search space early
3. **Recursive Backtracking**: Systematically explores word combinations
4. **Anagram Grouping**: Groups anagrams together to avoid duplicate searches

The JavaScript implementation is a direct port of the Python version, maintaining the same algorithm and performance characteristics.

## Files

- `index.html` - Web interface
- `styles.css` - Styling for the web interface
- `pangram-solver.js` - JavaScript port of the algorithm
- `shavian_pangram.py` - Original Python implementation
- `readlex/` - Git submodule containing the Shavian dictionary

## Dictionary

This project uses the [readlex](https://github.com/Shavian-info/readlex) dictionary, which contains English words transcribed in the Shavian alphabet. The dictionary is included as a git submodule.

## License

[Add your license information here]
