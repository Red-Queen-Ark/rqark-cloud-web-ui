<template>
  <div class="relative w-full" :style="{ height: `${height}px` }">
    <canvas ref="canvas" data-testid="usage-chart"></canvas>
  </div>
</template>

<script setup lang="ts">
import type { Chart as ChartInstance } from 'chart.js';
import { BarController, BarElement, CategoryScale, Chart, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import { usageChartColors } from '@/utils/chartColors';
import { formatTokens, type UsageBucket } from '@/utils/usage';

Chart.register(BarController, BarElement, CategoryScale, LineController, LineElement, LinearScale, PointElement, Tooltip);

const props = withDefaults(defineProps<{ buckets: UsageBucket[]; promptLabel: string; completionLabel: string; cachedLabel: string; height?: number }>(), { height: 280 });

const themeStore = useThemeStore();
const canvas = ref<HTMLCanvasElement | null>(null);
let chart: ChartInstance | undefined;

function destroy() {
  chart?.destroy();
  chart = undefined;
}

function build() {
  destroy();

  const context = canvas.value?.getContext('2d');
  if (!canvas.value || !context) {
    return;
  }

  const colors = usageChartColors();

  try {
    chart = new Chart(context, {
      data: {
        labels: props.buckets.map((bucket) => bucket.label),
        datasets: [
          {
            type: 'bar',
            label: props.promptLabel,
            data: props.buckets.map((bucket) => bucket.promptTokens),
            backgroundColor: colors.prompt,
            stack: 'tokens',
            borderRadius: 4,
            borderSkipped: false,
            order: 2,
          },
          {
            type: 'bar',
            label: props.completionLabel,
            data: props.buckets.map((bucket) => bucket.completionTokens),
            backgroundColor: colors.completion,
            stack: 'tokens',
            borderRadius: 4,
            borderSkipped: false,
            order: 2,
          },
          {
            type: 'line',
            label: props.cachedLabel,
            data: props.buckets.map((bucket) => bucket.cachedTokens),
            borderColor: colors.cached,
            backgroundColor: colors.cached,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3,
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { color: colors.grid },
            ticks: { color: colors.text, maxRotation: 0, autoSkip: true },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: colors.grid },
            border: { display: false },
            ticks: {
              color: colors.text,
              callback: (value) => formatTokens(Number(value)),
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: colors.text, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
          },
          tooltip: {
            backgroundColor: colors.surface,
            titleColor: colors.text,
            bodyColor: colors.text,
            borderColor: colors.grid,
            borderWidth: 1,
            callbacks: {
              label: (item) => `${item.dataset.label ?? ''}: ${formatTokens(Number(item.raw))}`,
            },
          },
        },
      },
    });
  } catch {
    chart = undefined;
  }
}

onMounted(build);
onBeforeUnmount(destroy);

watch(() => props.buckets, build, { deep: true });
watch(() => themeStore.theme, build);
</script>
