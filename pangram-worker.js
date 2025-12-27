// Web Worker for pangram solver
// This runs in a background thread

importScripts('pangram-solver.js');

let solver = null;

// Listen for messages from main thread
self.onmessage = function(e) {
    const { type, data } = e.data;

    if (type === 'init') {
        // Initialize solver with dictionary data
        solver = new PangramSolver(data.dictionary);
        self.postMessage({ type: 'ready' });
    } else if (type === 'solve') {
        // Set up callback to send solutions back as they're found
        solver.onSolution = (solution, count) => {
            self.postMessage({
                type: 'solution',
                data: { solution, count }
            });
        };

        // Run solver
        try {
            const solutions = solver.solvePangram(
                data.targetLetters,
                data.maxSolutions,
                data.excludeWords,
                data.excludePos,
                data.skipSolutions,
                data.alphabet
            );

            // Send completion message
            self.postMessage({
                type: 'complete',
                data: { totalSolutions: solutions.length }
            });
        } catch (err) {
            self.postMessage({
                type: 'error',
                data: { error: err.message }
            });
        }
    }
};
