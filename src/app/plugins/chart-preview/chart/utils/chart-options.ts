import { ChartTypes, Palette } from "../../chart-types.enum";

export function buildChartOptions(type: ChartTypes, aspectRatio: number, p: Palette) {
  const base: any = {
    maintainAspectRatio: true,
    aspectRatio,
    plugins: {
      legend: {
        labels: { color: p.text},
        position: 'bottom',
        align: 'start',
      },
    },
  };

  const scales = {
    x: {
      stacked: false,
      ticks: { color: p.text, font: { weight: 500 } },
      grid: { color: p.grid },
    },
    y: {
      stacked: false,
      ticks: { color: p.text },
      grid: { color: p.grid },
    },
  };

  switch (type) {
    case ChartTypes.Bar:
      return { ...base, scales };

    case ChartTypes.BarStacked:
      return {
        ...base,
        scales: {
          ...scales,
          x: { ...scales.x, stacked: true },
          y: { ...scales.y, stacked: true },
        },
      };

    case ChartTypes.BarHorizontal:
      return { ...base, indexAxis: 'y', scales };

    case ChartTypes.BarHorizontalStacked:
      return {
        ...base,
        indexAxis: 'y',
        scales: {
          ...scales,
          x: { ...scales.x, stacked: true },
          y: { ...scales.y, stacked: true },
        },
      };

    case ChartTypes.Line:
      return { ...base, scales };

    case ChartTypes.Doughnut:
      return { ...base, cutout: '60%', scales: undefined };

    default:
      return { ...base, scales };
  }
}
