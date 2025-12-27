/**
 * Shavian Pangram Solver (JavaScript port)
 * Finds perfect pangrams (using each letter exactly once) for the Shavian alphabet.
 */

class TrieNode {
    constructor() {
        this.children = new Map(); // Maps Shavian letter -> TrieNode
        this.isWord = false; // True if a word ends at this node
        this.key = null; // The rarity-sorted key for lookup in keyToWords
    }
}

class PangramSolver {
    constructor(wordsData) {
        this.shawWords = []; // List of Shavian words
        this.shawToPos = new Map(); // Map from Shavian word -> Set of pos tags
        this.trie = new TrieNode();
        this.loadWords(wordsData);

        // Letter frequency for ordering (built during buildTrie)
        this.letterOrder = []; // Letters sorted by rarity (rarest first)
        this.keyToWords = new Map(); // Map from rarity-sorted key -> list of original words

        // Progress tracking
        this.attemptCount = 0;
        this.branchCount = 0;
        this.pruneCount = 0;
        this.startTime = null;
        this.solutionCount = 0;

        // Callback for solutions
        this.onSolution = null;
        this.onProgress = null;
    }

    loadWords(data) {
        console.log('Loading words from data...');

        for (const [key, entries] of Object.entries(data)) {
            for (const entry of entries) {
                const shaw = entry.Shaw || '';
                const pos = entry.pos || '';

                if (shaw) { // Only include entries with Shavian text
                    this.shawWords.push(shaw);

                    // Track all pos tags for this word
                    if (!this.shawToPos.has(shaw)) {
                        this.shawToPos.set(shaw, new Set());
                    }
                    if (pos) {
                        this.shawToPos.get(shaw).add(pos);
                    }
                }
            }
        }

        console.log(`Loaded ${this.shawWords.length} words`);
    }

    buildTrie(targetLetters, excludeWords = new Set(), excludePos = new Set()) {
        this.trie = new TrieNode();
        this.keyToWords = new Map();

        console.log(`Building Trie for ${targetLetters.size} target letters...`);
        if (excludeWords.size > 0) {
            console.log(`Excluding ${excludeWords.size} word(s)`);
        }
        if (excludePos.size > 0) {
            console.log(`Excluding pos tags: ${[...excludePos].sort().join(', ')}`);
        }

        // Step 1: Build histogram of letter frequencies in target words
        const letterCounts = new Map();
        const filteredWords = [];

        for (const shaw of this.shawWords) {
            const shawSet = new Set(shaw);

            // Check if word should be excluded
            if (excludeWords.has(shaw)) {
                continue;
            }

            // Check if word has any excluded pos tags
            if (excludePos.size > 0 && this.shawToPos.has(shaw)) {
                const wordPos = this.shawToPos.get(shaw);
                const hasExcludedPos = [...excludePos].some(pos => wordPos.has(pos));
                if (hasExcludedPos) {
                    continue;
                }
            }

            // Check if word only uses target letters
            const usesOnlyTargetLetters = [...shawSet].every(letter => targetLetters.has(letter));
            if (usesOnlyTargetLetters) {
                filteredWords.push(shaw);
                for (const letter of shaw) {
                    letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
                }
            }
        }

        // Step 2: Create letter order (rarest first = ascending frequency)
        this.letterOrder = [...letterCounts.entries()]
            .sort((a, b) => a[1] - b[1]) // Sort by count ascending
            .map(([letter, _]) => letter);

        console.log(`Letter order (rarest first): ${this.letterOrder.join('')}`);

        // Step 3: Build keyToWords dictionary
        const keyToWordsSets = new Map();
        for (const shaw of filteredWords) {
            // Sort letters by rarity order to create key
            const key = [...shaw].sort((a, b) => {
                const indexA = this.letterOrder.indexOf(a);
                const indexB = this.letterOrder.indexOf(b);
                return (indexA === -1 ? this.letterOrder.length : indexA) -
                       (indexB === -1 ? this.letterOrder.length : indexB);
            }).join('');

            // Add to dictionary (using Set to deduplicate)
            if (!keyToWordsSets.has(key)) {
                keyToWordsSets.set(key, new Set());
            }
            keyToWordsSets.get(key).add(shaw);
        }

        // Convert sets to sorted arrays
        for (const [key, words] of keyToWordsSets.entries()) {
            this.keyToWords.set(key, [...words].sort());
        }

        // Step 4: Build Trie from keys
        for (const key of this.keyToWords.keys()) {
            this._addKeyToTrie(key);
        }

        // Step 5: Sort all Trie node children by rarity
        this._sortTrieChildren(this.trie);

        console.log(`Built Trie with ${filteredWords.length} words (${this.keyToWords.size} unique keys)`);
    }

    _addKeyToTrie(key) {
        let node = this.trie;
        for (const letter of key) {
            if (!node.children.has(letter)) {
                node.children.set(letter, new TrieNode());
            }
            node = node.children.get(letter);
        }

        // Mark this node as a word ending and store the key
        node.isWord = true;
        node.key = key;
    }

    _sortTrieChildren(node) {
        if (node.children.size === 0) {
            return;
        }

        // Sort children and rebuild map in sorted order
        const sortedEntries = [...node.children.entries()].sort((a, b) => {
            const indexA = this.letterOrder.indexOf(a[0]);
            const indexB = this.letterOrder.indexOf(b[0]);
            return (indexA === -1 ? this.letterOrder.length : indexA) -
                   (indexB === -1 ? this.letterOrder.length : indexB);
        });

        node.children = new Map(sortedEntries);

        // Recursively sort children
        for (const child of node.children.values()) {
            this._sortTrieChildren(child);
        }
    }

    solvePangram(targetLetters = null, maxSolutions = null, excludeWords = new Set(), excludePos = new Set()) {
        if (targetLetters === null) {
            // All 48 Shavian letters (BMP Unicode block U+10450–U+1047F)
            targetLetters = '';
            for (let i = 0x10450; i < 0x10480; i++) {
                targetLetters += String.fromCodePoint(i);
            }
        }

        const targetSet = new Set(targetLetters);
        const targetCounter = new Map();
        for (const letter of targetLetters) {
            targetCounter.set(letter, (targetCounter.get(letter) || 0) + 1);
        }

        console.log(`Solving pangram for ${targetSet.size} unique letters (${targetLetters.length} total letters)...`);

        // Build Trie with filtered words
        this.buildTrie(targetSet, excludeWords, excludePos);

        if (this.trie.children.size === 0) {
            console.log('No words found using only target letters!');
            return [];
        }

        // Initialize progress tracking
        this.attemptCount = 0;
        this.branchCount = 0;
        this.pruneCount = 0;
        this.startTime = Date.now();
        this.solutionCount = 0;

        console.log('\n' + '='.repeat(70));
        console.log('Solutions:');
        console.log('='.repeat(70));

        // Start recursive search from Trie root
        const solutions = [];
        this._search(targetCounter, [], solutions, maxSolutions);

        // Final stats
        const elapsed = (Date.now() - this.startTime) / 1000;
        console.log(`\n${'='.repeat(70)}`);
        console.log(`Search complete: ${this.branchCount} branches explored, ${this.attemptCount} attempts, ${this.pruneCount} pruned in ${elapsed.toFixed(1)}s`);
        console.log('='.repeat(70));

        return solutions;
    }

    _search(remaining, currentWords, solutions, maxSolutions, depth = 0) {
        // Check if we've found enough solutions
        if (maxSolutions !== null && solutions.length >= maxSolutions) {
            return;
        }

        // Check if we found a solution
        const totalRemaining = [...remaining.values()].reduce((sum, val) => sum + val, 0);
        if (totalRemaining === 0) {
            solutions.push([...currentWords]);
            this.solutionCount++;
            console.log(`Solution ${this.solutionCount}: '${currentWords.join(' ')}'`);

            // Call solution callback if provided
            if (this.onSolution) {
                this.onSolution([...currentWords], this.solutionCount);
            }
            return;
        }

        // Prune: if no letters remaining
        if (totalRemaining <= 0) {
            return;
        }

        // Find words starting with each available letter (prioritizing rarest)
        this._findWordsFromRoot(remaining, currentWords, solutions, maxSolutions, depth);
    }

    _findWordsFromRoot(remaining, currentWords, solutions, maxSolutions, depth) {
        // Find the rarest remaining letter
        let rarestLetter = null;
        for (const letter of this.letterOrder) {
            if ((remaining.get(letter) || 0) > 0) {
                rarestLetter = letter;
                break;
            }
        }

        if (rarestLetter && this.trie.children.has(rarestLetter)) {
            const child = this.trie.children.get(rarestLetter);
            remaining.set(rarestLetter, remaining.get(rarestLetter) - 1);
            this._searchTrie(child, remaining, [rarestLetter], currentWords, solutions, maxSolutions, depth);
            remaining.set(rarestLetter, remaining.get(rarestLetter) + 1);
        }
    }

    _searchTrie(node, remaining, currentLetters, currentWords, solutions, maxSolutions, depth) {
        this.attemptCount++;

        // Check if we've found enough solutions
        if (maxSolutions !== null && solutions.length >= maxSolutions) {
            return;
        }

        // Continue exploring - try extending by following Trie edges
        for (const [letter, child] of node.children) {
            if ((remaining.get(letter) || 0) > 0) {
                currentLetters.push(letter);
                remaining.set(letter, remaining.get(letter) - 1);

                this._searchTrie(child, remaining, currentLetters, currentWords, solutions, maxSolutions, depth);

                // Restore state
                remaining.set(letter, remaining.get(letter) + 1);
                currentLetters.pop();

                // Check if we should stop
                if (maxSolutions !== null && solutions.length >= maxSolutions) {
                    return;
                }
            }
        }

        // If this node is a complete word, try using it
        if (node.isWord && node.key) {
            this.branchCount++;
            const key = node.key;

            // Get all anagrams for this key
            const originalWords = this.keyToWords.get(key) || [];
            if (originalWords.length > 0) {
                // Format: single word as-is, multiple anagrams in brackets
                const word = originalWords.length === 1
                    ? originalWords[0]
                    : '[' + originalWords.join(' / ') + ']';

                // Add word and recurse - letters already consumed during Trie traversal
                currentWords.push(word);

                // Recurse for next word with current remaining
                this._search(remaining, currentWords, solutions, maxSolutions, depth + 1);

                // Backtrack
                currentWords.pop();
            }
        }
    }
}
