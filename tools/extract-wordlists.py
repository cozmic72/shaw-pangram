#!/usr/bin/env python3
"""
Extract simplified word lists from readlex.json.
Creates two text files: shavian-words.txt and roman-words.txt
"""

import json
import sys

def extract_wordlists(readlex_path, output_dir):
    print(f"Loading {readlex_path}...")
    with open(readlex_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    shavian_words = set()
    roman_words = set()

    for key, entries in data.items():
        for entry in entries:
            shaw = entry.get('Shaw', '').strip()
            latn = entry.get('Latn', '').strip()

            # Split multi-word phrases on spaces and add each word separately
            if shaw:
                for word in shaw.split():
                    if word:  # Skip empty strings
                        shavian_words.add(word)
            if latn:
                for word in latn.split():
                    if word:  # Skip empty strings
                        roman_words.add(word)

    # Sort for consistent output
    shavian_words = sorted(shavian_words)
    roman_words = sorted(roman_words)

    # Write Shavian words
    shavian_path = f"{output_dir}/shavian-words.txt"
    with open(shavian_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(shavian_words))
    print(f"Wrote {len(shavian_words)} Shavian words to {shavian_path}")

    # Write Roman words
    roman_path = f"{output_dir}/roman-words.txt"
    with open(roman_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(roman_words))
    print(f"Wrote {len(roman_words)} Roman words to {roman_path}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: extract-wordlists.py <readlex.json> <output_dir>")
        sys.exit(1)

    extract_wordlists(sys.argv[1], sys.argv[2])
