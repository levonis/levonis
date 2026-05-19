// Shared types between the Web Worker, the client wrapper and the edge function.

export interface ModelMetrics {
  volume_cm3: number;
  surface_area_cm2: number;
  bbox_mm: { x: number; y: number; z: number };
  triangle_count: number;
  complexity: number; // 0..100
}

export interface QualityReport {
  non_manifold_edges: number;
  non_manifold_pct: number;
  flipped_normals_pct: number;
  overhang_pct: number;          // share of triangles with normal.z < -sin(45°)
  min_wall_mm: number | null;    // null = couldn't measure
  thin_wall_warning: boolean;
  support_required: boolean;
  watertight: boolean;
}

export interface AnalyzeRequest {
  buffer: ArrayBuffer;
  fileName: string;
  fileExt: 'stl' | '3mf' | 'obj';
}

export type AnalyzeProgress =
  | { type: 'progress'; stage: string; pct: number }
  | { type: 'done'; metrics: ModelMetrics; quality: QualityReport; fileHash: string }
  | { type: 'error'; message: string };
