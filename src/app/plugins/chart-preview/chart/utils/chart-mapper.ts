import { ChartInputAttributes, ChartTypes } from '../../chart-types.enum';
import { readPalette } from './chart-colors';

export function buildChartData(attrs: ChartInputAttributes, type: ChartTypes) {
  const palette = readPalette();

  const labels = (attrs.labels ?? '')
    .toString()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const raw = Array.isArray(attrs.data) ? attrs.data : [];

  const datasets = raw.map((ds, i) => {
    const label = ds?.attributes?.label ?? `Series ${i + 1}`;
    const values = (ds?.attributes?.values ?? '')
      .toString()
      .split(',')
      .map(s => s.trim().toLowerCase() === 'null' ? '0' : s.trim())
      .map(s => {
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
      });

    const backgroundColor =
      type === ChartTypes.Doughnut
        ? labels.map((_, idx) => palette.series[idx % palette.series.length])
        : (i % 2 === 0 ? palette.barLineA : palette.barLineB);

      console.log(backgroundColor,'backgroundColor')

    const base: any = {
      label,
      data: values,
      backgroundColor,
      borderColor: 'transparent',
    };

    if (type === ChartTypes.Line) {
      base.pointStyle = 'circle';
      base.pointRadius = 3;
      base.pointHoverRadius = 5;
      base.borderColor = i % 2 === 0 ? palette.barLineA : palette.barLineB
    }

    return base;
  });

  return {
    chartData: { labels, datasets },
    palette,
  };
}
