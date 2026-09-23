import { runScenario } from './demo.mjs';

self.addEventListener('message', (event) => {
  const { id, requestId } = event.data ?? {};
  try {
    self.postMessage({ requestId, run: runScenario(id) });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Unknown research-engine error.',
    });
  }
});
