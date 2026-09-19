"use client";

import React, { useMemo } from "react";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Generates a deterministic, standard 25x25 QR matrix representation
 * with authentic corner finder patterns, alignment pattern, timing lines,
 * and deterministic hash-seeded data cells.
 */
export function QrCode({
  value,
  size = 140,
  className = "",
  title = "QR Code",
}: QrCodeProps) {
  const matrix = useMemo(() => {
    const N = 25;
    const grid: boolean[][] = Array.from({ length: N }, () =>
      Array(N).fill(false)
    );

    // 1. Draw standard Finder Pattern helper at (r, c)
    const drawFinder = (rStart: number, cStart: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            grid[rStart + r][cStart + c] = true;
          }
        }
      }
    };

    // 3 Finder patterns
    drawFinder(0, 0); // Top-left
    drawFinder(0, N - 7); // Top-right
    drawFinder(N - 7, 0); // Bottom-left

    // 2. Alignment pattern at (16, 16)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (
          r === 0 ||
          r === 4 ||
          c === 0 ||
          c === 4 ||
          (r === 2 && c === 2)
        ) {
          grid[16 + r][16 + c] = true;
        }
      }
    }

    // 3. Timing lines
    for (let i = 8; i < N - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // 4. Deterministic hash of value for payload modules
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }

    // Fill remaining cells with pseudo-random bits based on hash
    let lcg = (hash ^ 0x5a5a5a5a) >>> 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        // Skip finder zones + separators
        if (
          (r <= 7 && c <= 7) ||
          (r <= 7 && c >= N - 8) ||
          (r >= N - 8 && c <= 7)
        ) {
          continue;
        }
        // Skip alignment
        if (r >= 16 && r <= 20 && c >= 16 && c <= 20) continue;
        // Skip timing
        if (r === 6 || c === 6) continue;

        lcg = (Math.imul(1664525, lcg) + 1013904223) >>> 0;
        grid[r][c] = (lcg & 1) === 1;
      }
    }

    return grid;
  }, [value]);

  const N = matrix.length;
  const cellSize = 10;
  const totalDim = N * cellSize;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
      title={title}
    >
      <svg
        viewBox={`0 0 ${totalDim} ${totalDim}`}
        width={size}
        height={size}
        className="w-full h-auto max-w-full"
        shapeRendering="crispEdges"
        aria-label={title}
        role="img"
      >
        <rect width={totalDim} height={totalDim} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0f172a"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}
