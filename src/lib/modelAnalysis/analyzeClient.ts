// Thin wrapper around the model analyzer Web Worker.
// Loads it lazily so the heavy three.js bundle isn't pulled into the main chunk.
import type { AnalyzeProgress, ModelMetrics, QualityReport } from './types';

export interface AnalyzeResult {
  metrics: ModelMetrics;
  quality: QualityReport;
  fileHash: string;
}

export interface AnalyzeOptions {
  onProgress?: (stage: string, pct: number) => void;
}

export function detectExt(name: string): 'stl' | '3mf' | 'obj' | null {
  const m = name.toLowerCase().match(/\.(stl|3mf|obj)$/);
  return m ? (m[1] as 'stl' | '3mf' | 'obj') : null;
}

export async function analyzeModelFile(file: File, opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const ext = detectExt(file.name);
  if (!ext) throw new Error('Unsupported file. Use STL, 3MF, or OBJ.');
  if (file.size > 100 * 1024 * 1024) throw new Error('File too large (max 100MB).');

  const buffer = await file.arrayBuffer();

  // Lazy create the worker as a module so vite bundles three.js into it.
  const worker = new Worker(new URL('../../workers/modelAnalyzer.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise<AnalyzeResult>((resolve, reject) => {
    worker.onmessage = (ev: MessageEvent<AnalyzeProgress>) => {
      const msg = ev.data;
      if (msg.type === 'progress') {
        opts.onProgress?.(msg.stage, msg.pct);
      } else if (msg.type === 'done') {
        worker.terminate();
        resolve({ metrics: msg.metrics, quality: msg.quality, fileHash: msg.fileHash });
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Worker error'));
    };
    // Transfer the ArrayBuffer (zero-copy).
    worker.postMessage({ buffer, fileName: file.name, fileExt: ext }, [buffer]);
  });
}
