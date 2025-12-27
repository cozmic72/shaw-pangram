#!/usr/bin/env python3
"""
Shavian Pangram Solver
Finds perfect pangrams (using each letter exactly once) for the Shavian alphabet.
Can also be used for general anagram solving and working with subsets of letters.
"""

import json
from collections import Counter, defaultdict
from typing import List, Set, Optional, Tuple
import sys
import time


class TrieNode:
    """Node in a Trie structure for efficient word lookup."""
    def __init__(self):
        self.children = {}  # Maps Shavian letter -> TrieNode
        self.is_word = False  # True if a word ends at this node
        self.key = None  # The rarity-sorted key for lookup in key_to_words


class PangramSolver:
    """Solves pangram and anagram puzzles using recursive backtracking with Trie optimization."""

    def __init__(self, readlex_path: str):
        """Initialize solver with readlex JSON data."""
        self.readlex_path = readlex_path
        self.shaw_words = []  # List of Shavian words
        self.shaw_to_pos = {}  # Map from Shavian word -> set of pos tags
        self.trie = TrieNode()
        self.load_words()

        # Letter frequency for ordering (built during build_trie)
        self.letter_order = []  # Letters sorted by rarity (rarest first)
        self.key_to_words = {}  # Map from rarity-sorted key -> list of original words

        # Progress tracking
        self.attempt_count = 0
        self.branch_count = 0
        self.prune_count = 0
        self.start_time = None
        self.last_logged_prefix = None
        self.solution_count = 0

    def load_words(self):
        """Load words from readlex JSON file."""
        print(f"Loading words from {self.readlex_path}...", file=sys.stderr)
        with open(self.readlex_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for key, entries in data.items():
            for entry in entries:
                shaw = entry.get('Shaw', '')
                pos = entry.get('pos', '')
                if shaw:  # Only include entries with Shavian text
                    self.shaw_words.append(shaw)
                    # Track all pos tags for this word
                    if shaw not in self.shaw_to_pos:
                        self.shaw_to_pos[shaw] = set()
                    if pos:
                        self.shaw_to_pos[shaw].add(pos)

        print(f"Loaded {len(self.shaw_words)} words", file=sys.stderr)

    def build_trie(self, target_letters: Set[str], exclude_words: Set[str] = None,
                   exclude_pos: Set[str] = None):
        """Build a Trie of words that only use letters from target set, ordered by letter rarity."""
        self.trie = TrieNode()
        self.key_to_words = {}

        if exclude_words is None:
            exclude_words = set()
        if exclude_pos is None:
            exclude_pos = set()

        print(f"Building Trie for {len(target_letters)} target letters...", file=sys.stderr)
        if exclude_words:
            print(f"Excluding {len(exclude_words)} word(s)", file=sys.stderr)
        if exclude_pos:
            print(f"Excluding pos tags: {', '.join(sorted(exclude_pos))}", file=sys.stderr)

        # Step 1: Build histogram of letter frequencies in target words
        letter_counts = Counter()
        filtered_words = []

        for shaw in self.shaw_words:
            shaw_set = set(shaw)
            # Check if word should be excluded
            if shaw in exclude_words:
                continue
            # Check if word has any excluded pos tags
            if exclude_pos and self.shaw_to_pos.get(shaw, set()) & exclude_pos:
                continue
            # Check if word only uses target letters
            if shaw_set.issubset(target_letters):
                filtered_words.append(shaw)
                letter_counts.update(shaw)

        # Step 2: Create letter order (rarest first = ascending frequency)
        self.letter_order = [letter for letter, count in letter_counts.most_common()]
        self.letter_order.reverse()  # Rarest first

        print(f"Letter order (rarest first): {''.join(self.letter_order)}",
              file=sys.stderr)

        # Step 3: Build key_to_words dictionary (using sets to deduplicate)
        key_to_words_sets = {}
        for shaw in filtered_words:
            # Sort letters by rarity order to create key
            key = ''.join(sorted(shaw, key=lambda c: self.letter_order.index(c) if c in self.letter_order else len(self.letter_order)))

            # Add to dictionary (using set to deduplicate)
            if key not in key_to_words_sets:
                key_to_words_sets[key] = set()
            key_to_words_sets[key].add(shaw)

        # Convert sets to sorted lists
        self.key_to_words = {key: sorted(words) for key, words in key_to_words_sets.items()}

        # Step 4: Build Trie from keys
        for key in self.key_to_words.keys():
            self._add_key_to_trie(key)

        # Step 5: Sort all Trie node children by rarity (once, not every visit)
        self._sort_trie_children(self.trie)

        print(f"Built Trie with {len(filtered_words)} words ({len(self.key_to_words)} unique keys)", file=sys.stderr)

    def _add_key_to_trie(self, key: str):
        """Add a key to the Trie by following each letter in the sorted key."""
        node = self.trie
        for letter in key:
            if letter not in node.children:
                node.children[letter] = TrieNode()
            node = node.children[letter]

        # Mark this node as a word ending and store the key
        node.is_word = True
        node.key = key

    def _sort_trie_children(self, node: TrieNode):
        """Recursively sort all children by letter rarity (rarest first)."""
        if not node.children:
            return

        # Sort children and rebuild dict in sorted order
        sorted_items = sorted(node.children.items(),
                             key=lambda item: self.letter_order.index(item[0]) if item[0] in self.letter_order else len(self.letter_order))
        node.children = dict(sorted_items)

        # Recursively sort children
        for child in node.children.values():
            self._sort_trie_children(child)

    def solve_pangram(self, target_letters: Optional[str] = None, max_solutions: int = None,
                      exclude_words: Set[str] = None, exclude_pos: Set[str] = None) -> List[List[str]]:
        """
        Find perfect pangrams using each target letter exactly once.

        Args:
            target_letters: String of letters to use (None = all 48 Shavian letters)
            max_solutions: Maximum solutions to find (None = unlimited)
            exclude_words: Set of words to exclude from search (None = no exclusions)
            exclude_pos: Set of pos tags to exclude from search (None = no exclusions)

        Returns:
            List of solutions, where each solution is a list of letter combinations
        """
        if target_letters is None:
            # All 48 Shavian letters (BMP Unicode block U+10450–U+1047F)
            target_letters = ''.join(chr(i) for i in range(0x10450, 0x10480))

        target_set = set(target_letters)
        target_counter = Counter(target_letters)

        print(f"\nSolving pangram for {len(target_set)} unique letters " +
              f"({len(target_letters)} total letters)...", file=sys.stderr)

        # Build Trie with filtered words
        self.build_trie(target_set, exclude_words, exclude_pos)

        if not self.trie.children:
            print("No words found using only target letters!", file=sys.stderr)
            return []

        # Initialize progress tracking
        self.attempt_count = 0
        self.branch_count = 0
        self.prune_count = 0
        self.start_time = time.time()
        self.last_logged_prefix = None
        self.solution_count = 0

        print("\n" + "="*70)
        print("Solutions:")
        print("="*70)

        # Start recursive search from Trie root
        solutions = []
        self._search(target_counter, [], solutions, max_solutions)

        # Final stats
        elapsed = time.time() - self.start_time
        print(f"\n{'='*70}", file=sys.stderr)
        print(f"Search complete: {self.branch_count} branches explored, " +
              f"{self.attempt_count} attempts, {self.prune_count} pruned in {elapsed:.1f}s", file=sys.stderr)
        print(f"{'='*70}", file=sys.stderr)

        return solutions

    def _search(self, remaining: Counter, current_words: List[str],
                solutions: List, max_solutions: int, depth: int = 0):
        """
        Recursive backtracking search for pangrams using Trie traversal.

        Args:
            remaining: Counter of letters still needed
            current_words: Current list of letter combinations in solution
            solutions: List to accumulate solutions
            max_solutions: Stop when this many solutions found (None = unlimited)
            depth: Current recursion depth (for debugging)
        """
        # Check if we've found enough solutions
        if max_solutions is not None and len(solutions) >= max_solutions:
            return

        # Check if we found a solution
        if not any(remaining.values()):
            solutions.append(current_words[:])
            self.solution_count += 1
            print(f"Solution {self.solution_count}: '{' '.join(current_words)}'")
            return

        # Prune: if no letters remaining
        total_remaining = sum(remaining.values())
        if total_remaining <= 0:
            return

        # Find words starting with each available letter (prioritizing rarest)
        self._find_words_from_root(remaining, current_words, solutions, max_solutions, depth)

    def _find_words_from_root(self, remaining: Counter, current_words: List[str],
                               solutions: List, max_solutions: int, depth: int):
        """
        Find words by traversing from root, prioritizing rarest letter.

        Args:
            remaining: Counter of letters still available
            current_words: Current list of words in solution
            solutions: List to accumulate solutions
            max_solutions: Stop when this many solutions found (None = unlimited)
            depth: Current recursion depth
        """
        # Find the rarest remaining letter (guaranteed to exist due to check in _search)
        rarest_letter = None
        for letter in self.letter_order:
            if remaining[letter] > 0:
                rarest_letter = letter
                break

        if rarest_letter in self.trie.children.keys():
            child = self.trie.children[rarest_letter]
            remaining[rarest_letter] -= 1
            self._search_trie(child, remaining, [rarest_letter], current_words, solutions, max_solutions, depth)
            remaining[rarest_letter] += 1

    def _search_trie(self, node: TrieNode, remaining: Counter, current_letters: List[str],
                     current_words: List[str], solutions: List, max_solutions: int, depth: int):
        """
        Recursively traverse Trie to find and try words (depth-first).

        Args:
            node: Current Trie node
            remaining: Letters available to use
            current_letters: Current path of letters being explored (in key order)
            current_words: Words selected so far
            solutions: List to accumulate solutions
            max_solutions: Stop when this many solutions found (None = unlimited)
            depth: Current word depth
        """
        self.attempt_count += 1

        # Check if we've found enough solutions
        if max_solutions is not None and len(solutions) >= max_solutions:
            return

        # Continue exploring - try extending by following Trie edges
        # Children are already sorted by rarity during Trie construction
        for letter, child in node.children.items():
            if remaining[letter] > 0:
                current_letters.append(letter)
                remaining[letter] -= 1

                self._search_trie(child, remaining, current_letters, current_words,
                                 solutions, max_solutions, depth)

                # Restore state
                remaining[letter] += 1
                current_letters.pop()

                # Check if we should stop
                if max_solutions is not None and len(solutions) >= max_solutions:
                    return

        # If this node is a complete word, try using it
        if node.is_word and node.key:
            self.branch_count += 1
            key = node.key

            # Get all anagrams for this key
            original_words = self.key_to_words.get(key, [])
            if original_words:
                # Format: single word as-is, multiple anagrams in brackets
                if len(original_words) == 1:
                    word = original_words[0]
                else:
                    word = '[' + ' / '.join(original_words) + ']'

                # Add word and recurse - letters already consumed during Trie traversal
                current_words.append(word)

                # Recurse for next word with current remaining (not double-subtracting)
                self._search(remaining, current_words, solutions, max_solutions, depth + 1)

                # Backtrack
                current_words.pop()

    def solve_anagram(self, letters: str) -> List[List[str]]:
        """
        Find anagrams that use all provided letters.
        This is an alias for solve_pangram with custom letters.
        """
        return self.solve_pangram(target_letters=letters)


def main():
    """Command-line interface for the pangram solver."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Find perfect pangrams for Shavian alphabet or solve anagrams',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Find pangrams for full 48-letter Shavian alphabet
  python shavian_pangram.py

  # Find pangrams for a subset of letters (all whitespace ignored)
  python shavian_pangram.py --letters "𐑐𐑑𐑒 𐑓𐑔𐑕"

  # Solve anagram with specific letters
  python shavian_pangram.py --letters "𐑣𐑧𐑤𐑴"

  # Use starter words to reduce the problem (all whitespace ignored)
  python shavian_pangram.py --starter-words "𐑐𐑑 𐑒𐑓"

  # Combine starter words with custom letters
  python shavian_pangram.py --letters "𐑐𐑑𐑒𐑓𐑔𐑕" --starter-words "𐑐𐑑"

  # Exclude specific words (space or comma-separated)
  python shavian_pangram.py --exclude-words "𐑐𐑑 𐑒𐑓 𐑔𐑕"
  python shavian_pangram.py --exclude-words "𐑐𐑑,𐑒𐑓,𐑔𐑕"

  # Exclude words by part-of-speech tag (space or comma-separated)
  python shavian_pangram.py --exclude-pos "n v"
  python shavian_pangram.py --exclude-pos "n,v,adj"

  # Use custom readlex file
  python shavian_pangram.py --readlex /path/to/readlex.json 
        """
    )

    parser.add_argument('--readlex', '-r',
                       default='~/Code/shavian-info/readlex/readlex.json',
                       help='Path to readlex.json file (default: ~/data/misc/readlex/readlex.json)')
    parser.add_argument('--letters', '-l',
                       default=None,
                       help='Target letters to use, all whitespace ignored (default: all 48 Shavian letters)')
    parser.add_argument('--starter-words', '-s',
                       default=None,
                       help='Starter words whose letters should be removed from target letters, all whitespace ignored')
    parser.add_argument('--exclude-words', '-e',
                       default=None,
                       help='Words to exclude from search, space/comma-separated')
    parser.add_argument('--exclude-pos',
                       default=None,
                       help='Part-of-speech tags to exclude, space/comma-separated (e.g., "n,v,adj" or "n v adj")')
    parser.add_argument('--max', '-m',
                       type=int,
                       default=None,
                       help='Maximum number of solutions to find (default: unlimited)')

    args = parser.parse_args()

    # Expand home directory
    import os
    readlex_path = os.path.expanduser(args.readlex)

    # Create solver
    solver = PangramSolver(readlex_path)

    # Process letters and starter words
    target_letters = args.letters
    if target_letters:
        # Remove all whitespace
        target_letters = ''.join(target_letters.split())

    if args.starter_words:
        # Remove all whitespace
        starter_words = ''.join(args.starter_words.split())
        if target_letters is None:
            # Default to all 48 Shavian letters
            target_letters = ''.join(chr(i) for i in range(0x10450, 0x10480))

        # Remove starter word letters from target
        target_counter = Counter(target_letters)
        for letter in starter_words:
            if target_counter[letter] > 0:
                target_counter[letter] -= 1
            else:
                print(f"Error: starter word letter '{letter}' not in target letters", file=sys.stderr)
                sys.exit(1)

        # Rebuild target_letters from counter
        target_letters = ''.join(letter * count for letter, count in target_counter.items() if count > 0)

    # Process exclude words (split on whitespace and commas)
    exclude_words = None
    if args.exclude_words:
        exclude_words = set(args.exclude_words.replace(',', ' ').split())

    # Process exclude pos tags (split on whitespace and commas)
    exclude_pos = None
    if args.exclude_pos:
        exclude_pos = set(args.exclude_pos.replace(',', ' ').split())

    # Solve
    solutions = solver.solve_pangram(target_letters=target_letters,
                                     max_solutions=args.max,
                                     exclude_words=exclude_words,
                                     exclude_pos=exclude_pos)

    # Print summary
    if not solutions:
        print("No solutions found.")
    print("="*70)


if __name__ == '__main__':
    main()
