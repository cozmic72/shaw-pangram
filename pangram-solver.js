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
        this.romanWords = []; // List of Roman words
        this.shawToPos = new Map(); // Map from Shavian word -> Set of pos tags
        this.romanToPos = new Map(); // Map from Roman word -> Set of pos tags
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

        // Yield counter for async operation
        this.yieldCounter = 0;
        this.yieldInterval = 100; // Yield every N attempts

        // For async wrapper
        this.solutionQueue = [];
        this.resolveNext = null;
        this.shouldPause = false;
        this.pausePromise = null;
    }

    loadWords(data) {
        console.log('Loading words from data...');

        for (const [key, entries] of Object.entries(data)) {
            for (const entry of entries) {
                const shaw = entry.Shaw || '';
                const roman = entry.Latn || '';
                const pos = entry.pos || '';

                if (shaw) {
                    this.shawWords.push(shaw);
                    if (!this.shawToPos.has(shaw)) {
                        this.shawToPos.set(shaw, new Set());
                    }
                    if (pos) {
                        this.shawToPos.get(shaw).add(pos);
                    }
                }

                if (roman) {
                    const romanLower = roman.toLowerCase();
                    this.romanWords.push(romanLower);
                    if (!this.romanToPos.has(romanLower)) {
                        this.romanToPos.set(romanLower, new Set());
                    }
                    if (pos) {
                        this.romanToPos.get(romanLower).add(pos);
                    }
                }
            }
        }

        console.log(`Loaded ${this.shawWords.length} Shavian words, ${this.romanWords.length} Roman words`);
    }

    buildTrie(targetLetters, excludeWords = new Set(), excludePos = new Set(), alphabet = 'shavian') {
        this.trie = new TrieNode();
        this.keyToWords = new Map();

        console.log(`Building Trie for ${targetLetters.size} target letters (${alphabet})...`);
        if (excludeWords.size > 0) {
            console.log(`Excluding ${excludeWords.size} word(s)`);
        }
        if (excludePos.size > 0) {
            console.log(`Excluding pos tags: ${[...excludePos].sort().join(', ')}`);
        }

        // Select word list and pos map based on alphabet
        const wordList = alphabet === 'roman' ? this.romanWords : this.shawWords;
        const wordToPos = alphabet === 'roman' ? this.romanToPos : this.shawToPos;

        // Step 1: Build histogram of letter frequencies in target words
        const letterCounts = new Map();
        const filteredWords = [];

        for (const word of wordList) {
            const wordSet = new Set(word);

            // Check if word should be excluded
            if (excludeWords.has(word)) {
                continue;
            }

            // Check if word has any excluded pos tags
            if (excludePos.size > 0 && wordToPos.has(word)) {
                const wordPosTags = wordToPos.get(word);
                const hasExcludedPos = [...excludePos].some(pos => wordPosTags.has(pos));
                if (hasExcludedPos) {
                    continue;
                }
            }

            // Check if word only uses target letters
            const usesOnlyTargetLetters = [...wordSet].every(letter => targetLetters.has(letter));
            if (usesOnlyTargetLetters) {
                filteredWords.push(word);
                for (const letter of word) {
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

    // Async generator wrapper around synchronous solver
    async *solvePangramAsync(targetLetters = null, maxSolutions = null, excludeWords = new Set(), excludePos = new Set(), skipSolutions = 0, alphabet = 'shavian') {
        this.solutionQueue = [];
        let solverDone = false;
        let solverError = null;
        let yieldCounter = 0;

        // Set up callback to capture solutions
        const originalCallback = this.onSolution;
        this.onSolution = (solution, count) => {
            // Add to queue
            this.solutionQueue.push(solution);

            // Call original callback if it exists
            if (originalCallback) {
                originalCallback(solution, count);
            }
        };

        // Enable pause mode for async
        this.shouldPause = true;

        // Start solver in background
        setTimeout(() => {
            try {
                this.solvePangram(targetLetters, maxSolutions, excludeWords, excludePos, skipSolutions, alphabet);
                solverDone = true;
            } catch (err) {
                solverError = err;
                solverDone = true;
            } finally {
                this.shouldPause = false;
            }
        }, 0);

        // Yield solutions as they're added to queue
        // Check queue periodically and yield what's there
        while (!solverDone || this.solutionQueue.length > 0) {
            if (this.solutionQueue.length > 0) {
                // Yield all pending solutions
                while (this.solutionQueue.length > 0) {
                    yield this.solutionQueue.shift();
                    // Let browser render after each solution
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } else if (!solverDone) {
                // Wait a bit for more solutions
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Restore original callback
        this.onSolution = originalCallback;

        if (solverError) {
            throw solverError;
        }
    }

    // Old generator version (keeping for reference, can be deleted later)
    *solvePangramGenerator_old(targetLetters = null, maxSolutions = null, excludeWords = new Set(), excludePos = new Set(), skipSolutions = 0, alphabet = 'shavian') {
        if (targetLetters === null) {
            if (alphabet === 'roman') {
                // All 26 Roman letters
                targetLetters = 'abcdefghijklmnopqrstuvwxyz';
            } else {
                // All 48 Shavian letters (BMP Unicode block U+10450–U+1047F)
                targetLetters = '';
                for (let i = 0x10450; i < 0x10480; i++) {
                    targetLetters += String.fromCodePoint(i);
                }
            }
        }

        const targetSet = new Set(targetLetters);
        const targetCounter = new Map();
        for (const letter of targetLetters) {
            targetCounter.set(letter, (targetCounter.get(letter) || 0) + 1);
        }

        console.log(`Solving pangram for ${targetSet.size} unique letters (${targetLetters.length} total letters) in ${alphabet}...`);
        if (skipSolutions > 0) {
            console.log(`Skipping first ${skipSolutions} solutions...`);
        }

        // If no letters remain, the empty solution is the only valid solution
        if (targetLetters.length === 0) {
            console.log('Exact match: no letters remaining, empty solution is valid.');
            yield [];
            return;
        }

        // Build Trie with filtered words
        this.buildTrie(targetSet, excludeWords, excludePos, alphabet);

        if (this.trie.children.size === 0) {
            console.log('No words found using only target letters!');
            return;
        }

        // Initialize progress tracking
        this.attemptCount = 0;
        this.branchCount = 0;
        this.pruneCount = 0;
        this.startTime = Date.now();
        this.solutionCount = 0;
        this.skippedCount = 0;
        this.skipSolutions = skipSolutions;
        this.yieldCounter = 0;

        console.log('\n' + '='.repeat(70));
        console.log('Solutions:');
        console.log('='.repeat(70));

        // Start recursive search from Trie root
        const solutions = [];
        yield* this._searchGenerator(targetCounter, [], solutions, maxSolutions);

        // Final stats
        const elapsed = (Date.now() - this.startTime) / 1000;
        console.log(`\n${'='.repeat(70)}`);
        console.log(`Search complete: ${this.branchCount} branches explored, ${this.attemptCount} attempts, ${this.pruneCount} pruned in ${elapsed.toFixed(1)}s`);
        console.log('='.repeat(70));

        return solutions;
    }

    solvePangram(targetLetters = null, maxSolutions = null, excludeWords = new Set(), excludePos = new Set(), skipSolutions = 0, alphabet = 'shavian') {
        if (targetLetters === null) {
            if (alphabet === 'roman') {
                // All 26 Roman letters
                targetLetters = 'abcdefghijklmnopqrstuvwxyz';
            } else {
                // All 48 Shavian letters (BMP Unicode block U+10450–U+1047F)
                targetLetters = '';
                for (let i = 0x10450; i < 0x10480; i++) {
                    targetLetters += String.fromCodePoint(i);
                }
            }
        }

        const targetSet = new Set(targetLetters);
        const targetCounter = new Map();
        for (const letter of targetLetters) {
            targetCounter.set(letter, (targetCounter.get(letter) || 0) + 1);
        }

        console.log(`Solving pangram for ${targetSet.size} unique letters (${targetLetters.length} total letters) in ${alphabet}...`);
        if (skipSolutions > 0) {
            console.log(`Skipping first ${skipSolutions} solutions...`);
        }

        // If no letters remain, the empty solution is the only valid solution
        if (targetLetters.length === 0) {
            console.log('Exact match: no letters remaining, empty solution is valid.');

            // Call solution callback if provided
            if (this.onSolution) {
                this.onSolution([], 1);
            }

            return [[]];
        }

        // Build Trie with filtered words
        this.buildTrie(targetSet, excludeWords, excludePos, alphabet);

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
        this.skippedCount = 0;
        this.skipSolutions = skipSolutions;

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

    *_searchGenerator(remaining, currentWords, solutions, maxSolutions, depth = 0) {
        // Yield control periodically
        this.yieldCounter++;
        if (this.yieldCounter % this.yieldInterval === 0) {
            yield null; // Yield control to allow UI updates
        }

        // Check if we've found enough solutions
        if (maxSolutions !== null && solutions.length >= maxSolutions) {
            return; // Signal to stop
        }

        // Check if we found a solution
        const totalRemaining = [...remaining.values()].reduce((sum, val) => sum + val, 0);
        if (totalRemaining === 0) {
            this.solutionCount++;
            console.log(`[Generator] Found solution #${this.solutionCount}:`, currentWords);

            // Skip solutions if needed
            if (this.skippedCount < this.skipSolutions) {
                this.skippedCount++;
                console.log(`[Generator] Skipping solution (${this.skippedCount}/${this.skipSolutions})`);
                return;
            }

            solutions.push([...currentWords]);
            const actualSolutionNumber = this.solutionCount - this.skipSolutions;
            console.log(`[Generator] Returning solution #${actualSolutionNumber}`);

            // Call solution callback if provided
            if (this.onSolution) {
                console.log(`[Generator] Calling onSolution callback`);
                this.onSolution([...currentWords], actualSolutionNumber);
            }

            // Yield the solution
            yield [...currentWords];

            // Check if we should stop
            if (maxSolutions !== null && solutions.length >= maxSolutions) {
                return;
            }
            return;
        }

        // Prune: if no letters remaining
        if (totalRemaining <= 0) {
            return;
        }

        // Find words starting with each available letter (prioritizing rarest)
        yield* this._findWordsFromRootGenerator(remaining, currentWords, solutions, maxSolutions, depth);
    }

    _search(remaining, currentWords, solutions, maxSolutions, depth = 0) {
        // Check if we need to pause (for async mode)
        if (this.shouldPause && depth === 0) {
            return true; // Signal to stop temporarily
        }

        // Check if we've found enough solutions
        if (maxSolutions !== null && solutions.length >= maxSolutions) {
            return true; // Signal to stop
        }

        // Check if we found a solution
        const totalRemaining = [...remaining.values()].reduce((sum, val) => sum + val, 0);
        if (totalRemaining === 0) {
            this.solutionCount++;

            // Skip solutions if needed
            if (this.skippedCount < this.skipSolutions) {
                this.skippedCount++;
                return false;
            }

            solutions.push([...currentWords]);
            const actualSolutionNumber = this.solutionCount - this.skipSolutions;
            // Solution found - don't log to reduce console noise

            // Call solution callback if provided
            if (this.onSolution) {
                this.onSolution([...currentWords], actualSolutionNumber);
            }

            // Pause after finding a solution to allow UI update
            if (this.shouldPause) {
                return true; // Pause
            }

            // Check if we should stop
            if (maxSolutions !== null && solutions.length >= maxSolutions) {
                return true;
            }
            return false;
        }

        // Prune: if no letters remaining
        if (totalRemaining <= 0) {
            return false;
        }

        // Find words starting with each available letter (prioritizing rarest)
        return this._findWordsFromRoot(remaining, currentWords, solutions, maxSolutions, depth);
    }

    *_findWordsFromRootGenerator(remaining, currentWords, solutions, maxSolutions, depth) {
        // Find the rarest remaining letter
        let rarestLetter = null;
        for (const letter of this.letterOrder) {
            if ((remaining.get(letter) || 0) > 0) {
                rarestLetter = letter;
                break;
            }
        }

        if (depth === 0) {
            console.log(`[Generator] Starting search, rarest letter: ${rarestLetter}, has child: ${rarestLetter && this.trie.children.has(rarestLetter)}`);
        }

        if (rarestLetter && this.trie.children.has(rarestLetter)) {
            const child = this.trie.children.get(rarestLetter);
            remaining.set(rarestLetter, remaining.get(rarestLetter) - 1);
            yield* this._searchTrieGenerator(child, remaining, [rarestLetter], currentWords, solutions, maxSolutions, depth);
            remaining.set(rarestLetter, remaining.get(rarestLetter) + 1);
        }
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
            const shouldStop = this._searchTrie(child, remaining, [rarestLetter], currentWords, solutions, maxSolutions, depth);
            remaining.set(rarestLetter, remaining.get(rarestLetter) + 1);
            return shouldStop;
        }
        return false;
    }

    *_searchTrieGenerator(node, remaining, currentLetters, currentWords, solutions, maxSolutions, depth) {
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

                yield* this._searchTrieGenerator(child, remaining, currentLetters, currentWords, solutions, maxSolutions, depth);

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
                yield* this._searchGenerator(remaining, currentWords, solutions, maxSolutions, depth + 1);

                // Backtrack
                currentWords.pop();
            }
        }
    }

    _searchTrie(node, remaining, currentLetters, currentWords, solutions, maxSolutions, depth) {
        this.attemptCount++;

        // Check if we've found enough solutions
        if (maxSolutions !== null && solutions.length >= maxSolutions) {
            return true;
        }

        // Continue exploring - try extending by following Trie edges
        for (const [letter, child] of node.children) {
            if ((remaining.get(letter) || 0) > 0) {
                currentLetters.push(letter);
                remaining.set(letter, remaining.get(letter) - 1);

                const shouldStop = this._searchTrie(child, remaining, currentLetters, currentWords, solutions, maxSolutions, depth);

                // Restore state
                remaining.set(letter, remaining.get(letter) + 1);
                currentLetters.pop();

                // Check if we should stop
                if (shouldStop) {
                    return true;
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
                const shouldStop = this._search(remaining, currentWords, solutions, maxSolutions, depth + 1);

                // Backtrack
                currentWords.pop();

                if (shouldStop) {
                    return true;
                }
            }
        }

        return false;
    }
}
