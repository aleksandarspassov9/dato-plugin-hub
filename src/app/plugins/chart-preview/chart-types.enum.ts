export enum ChartTypes {
    Bar = 'bar',
    BarStacked = 'bar_stacked',
    BarHorizontal = 'bar_horizontal',
    BarHorizontalStacked = 'bar_horizontal_stacked',
    Doughnut = 'doughnut',
    Line = 'line',
}

export interface ChartDatasetInput {
  attributes?: {
    label?: string;
    values?: string;
  };
}

export interface ChartInputAttributes {
  title?: string;
  chart_type?: ChartTypes;
  labels?: string;
  data?: ChartDatasetInput[];
  aspect_ratio?: number | string;
}

export interface ChartInput {
  attributes?: ChartInputAttributes;
}

export interface Palette {
  text: string;
  grid: string;
  series: string[];
  barLineA: string;
  barLineB: string;
}
