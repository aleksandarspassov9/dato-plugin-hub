import { ChartTypes } from "../../chart-types.enum";

export function chartJsTypeFrom(t: ChartTypes | undefined): string {
  switch (t) {
    case ChartTypes.Bar:
    case ChartTypes.BarStacked:
    case ChartTypes.BarHorizontal:
    case ChartTypes.BarHorizontalStacked:
      return 'bar';
    case ChartTypes.Line:
      return 'line';
    case ChartTypes.Doughnut:
      return 'doughnut';
    default:
      return 'bar';
  }
}
