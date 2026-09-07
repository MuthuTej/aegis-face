/**
 * performanceTracker — Phase-by-phase pipeline timing
 *
 * Tracks timing for each phase of the verification pipeline and maintains
 * rolling averages across sessions. Output format matches the existing
 * DebugMetrics type in src/types/index.ts for direct use in DebugScreen.
 */

import type { DebugMetrics } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhaseTimings {
  detectionMs: number;
  embeddingMs: number;
  verificationMs: number;
  totalMs: number;
}

export interface PerformanceSummary extends PhaseTimings {
  avgDetectionMs: number;
  avgEmbeddingMs: number;
  avgVerificationMs: number;
  avgTotalMs: number;
  sessionCount: number;
  lastUpdatedAt: number;
}

// ─── PerformanceTracker Class ─────────────────────────────────────────────────

export class PerformanceTracker {
  private phases: Map<string, number> = new Map();
  private lastTimings: PhaseTimings = { detectionMs: 0, embeddingMs: 0, verificationMs: 0, totalMs: 0 };

  // Rolling average state (window = 10 sessions)
  private history: PhaseTimings[] = [];
  private readonly maxHistory = 10;

  // ─── Phase tracking ─────────────────────────────────────────────────────

  startPhase(name: string): void {
    this.phases.set(name, Date.now());
  }

  endPhase(name: string): number {
    const start = this.phases.get(name);
    if (!start) return 0;
    const elapsed = Date.now() - start;
    this.phases.delete(name);
    return elapsed;
  }

  /** Record a complete pipeline result with explicit timings. */
  recordResult(timings: PhaseTimings): void {
    this.lastTimings = timings;
    this.history.push(timings);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  getLastTimings(): PhaseTimings {
    return this.lastTimings;
  }

  getSummary(): PerformanceSummary {
    const n = this.history.length;
    if (n === 0) {
      return {
        ...this.lastTimings,
        avgDetectionMs: 0,
        avgEmbeddingMs: 0,
        avgVerificationMs: 0,
        avgTotalMs: 0,
        sessionCount: 0,
        lastUpdatedAt: Date.now(),
      };
    }

    const sum = this.history.reduce(
      (acc, t) => ({
        detectionMs: acc.detectionMs + t.detectionMs,
        embeddingMs: acc.embeddingMs + t.embeddingMs,
        verificationMs: acc.verificationMs + t.verificationMs,
        totalMs: acc.totalMs + t.totalMs,
      }),
      { detectionMs: 0, embeddingMs: 0, verificationMs: 0, totalMs: 0 }
    );

    return {
      ...this.lastTimings,
      avgDetectionMs: sum.detectionMs / n,
      avgEmbeddingMs: sum.embeddingMs / n,
      avgVerificationMs: sum.verificationMs / n,
      avgTotalMs: sum.totalMs / n,
      sessionCount: n,
      lastUpdatedAt: Date.now(),
    };
  }

  /** Format for DebugMetrics type (connects to DebugScreen + useDebugMetrics). */
  toDebugMetrics(
    faceConfidence = 0,
    livenessScore = 0,
    embeddingScore = 0,
    fps = 0
  ): Partial<DebugMetrics> {
    const t = this.lastTimings;
    return {
      frameProcessingMs: t.detectionMs,
      modelInferenceMs: t.embeddingMs,
      totalPipelineMs: t.totalMs,
      currentFps: fps,
      confidenceBreakdown: {
        faceDetection: faceConfidence,
        livenessCheck: livenessScore,
        embeddingMatch: embeddingScore,
      },
    };
  }

  /** Human-readable report for demo/debug log output. */
  getReport(): string {
    const s = this.getSummary();
    return [
      `Detection: ${s.detectionMs}ms (avg ${s.avgDetectionMs.toFixed(0)}ms)`,
      `Embedding: ${s.embeddingMs}ms (avg ${s.avgEmbeddingMs.toFixed(0)}ms)`,
      `Verification: ${s.verificationMs}ms (avg ${s.avgVerificationMs.toFixed(0)}ms)`,
      `Total: ${s.totalMs}ms (avg ${s.avgTotalMs.toFixed(0)}ms)`,
      `Sessions: ${s.sessionCount}`,
    ].join(' | ');
  }

  reset(): void {
    this.phases.clear();
    this.history = [];
    this.lastTimings = { detectionMs: 0, embeddingMs: 0, verificationMs: 0, totalMs: 0 };
  }
}

// Singleton instance
export const performanceTracker = new PerformanceTracker();
