import {
  Component,
  ChangeDetectionStrategy,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  PLATFORM_ID,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { buildChartData } from './utils/chart-mapper';
import { buildChartOptions } from './utils/chart-options';
import { chartJsTypeFrom } from './utils/chart-types-map';
import { ChartInput, ChartTypes } from '../chart-types.enum';


@Component({
  selector: 'gfp-chart-component',
  standalone: true,
  templateUrl: './chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartModule],
})
export class ChartComponent implements OnChanges {
  private platformId = inject(PLATFORM_ID);
  constructor(private cd: ChangeDetectorRef) {}

  private _data?: ChartInput;
  @Input() set data(val: ChartInput | undefined) {
    this._data = val;
    this.recompute();
  }
  get data() { return this._data; }

  @Input() preview = false;

  title = '';
  chartType: any | undefined;
  chartJsType: any = 'bar';
  chartData: any;
  options: any;

  ngOnChanges(_: SimpleChanges): void {
    this.recompute();
  }

  private recompute(): void {
    if (!this._data?.attributes) return;
    if (!isPlatformBrowser(this.platformId)) return;

    const attrs = this._data.attributes;
    this.title = attrs.title ?? '';
    this.chartType = attrs.chart_type ?? ChartTypes.Bar;
    this.chartJsType = chartJsTypeFrom(this.chartType);

    const { chartData, palette } = buildChartData(attrs, this.chartType);
    console.log(chartData),
    console.log(palette),
    this.chartData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Sales',
        data: [120, 90, 150, 80],
        backgroundColor: ['rgba(99,132,255,0.5)','rgba(255,159,64,0.5)','rgba(75,192,192,0.5)','rgba(255,99,132,0.5)'],
        borderColor: ['rgb(99,132,255)','rgb(255,159,64)','rgb(75,192,192)','rgb(255,99,132)'],
        borderWidth: 1,
      },
    ],
  };

    const aspectRatio = Number(attrs.aspect_ratio) || 2;
    this.options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: { enabled: true },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };;
    console.log(this.chartData)

    this.cd.markForCheck();
  }
}
