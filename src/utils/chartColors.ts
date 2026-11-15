const FALLBACK: Record<string, string> = {
  primary: '#6366f1',
  secondary: '#22d3ee',
  'base-content': '#6b7280',
  'base-300': '#d4d4d8',
  'base-200': '#e5e7eb',
};

const DEFAULT_COLOR = '#888888';

let probe: CanvasRenderingContext2D | null | undefined;

function probeContext(): CanvasRenderingContext2D | null {
  if (probe === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext('2d', { willReadFrequently: true });
  }
  return probe;
}

export function themeColor(name: string, alpha = 1): string {
  const fallback = FALLBACK[name] ?? DEFAULT_COLOR;

  if (typeof document === 'undefined') {
    return fallback;
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim() || fallback;
  const ctx = probeContext();

  if (!ctx) {
    return raw;
  }

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = fallback;
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);

  const data = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${String(data[0])}, ${String(data[1])}, ${String(data[2])}, ${String(alpha)})`;
}

export function usageChartColors() {
  return {
    prompt: themeColor('primary'),
    completion: themeColor('secondary'),
    grid: themeColor('base-content', 0.15),
    text: themeColor('base-content'),
    surface: themeColor('base-200'),
  };
}
