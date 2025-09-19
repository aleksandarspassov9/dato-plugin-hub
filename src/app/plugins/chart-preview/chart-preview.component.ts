import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ChartComponent } from './chart/chart.component';

@Component({
    selector: 'dato-chart-preview',
    standalone: true,
    imports: [CommonModule, ButtonModule, ChartComponent],
    template: `
    <div style="padding:16px; font:inherit;">
      @if (chartData.attributes.data.length === 0) {
        <h3 style="margin:0 0 8px;">The chart preview will appear once you add a dataset.</h3>
      } @else {
        <gfp-chart-component [data]="chartData"></gfp-chart-component>
      }
    </div>
    `
})
export class ChartPreviewComponent implements OnChanges {
  @Input() ctx: any;

  chartData: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ctx) return;

    const chartPreviewDataIndex = this.ctx.formValues?.components.findIndex(c => Object.hasOwn(c, 'chart_preview'))
    const chartPreviewData = this.ctx.formValues?.components[chartPreviewDataIndex]

    this.chartData = {
      attributes: {
        title: chartPreviewData.title,
        chart_type: chartPreviewData.chart_type,
        labels: chartPreviewData.labels,
        data: chartPreviewData.data,
        aspect_ratio: chartPreviewData.aspect_ratio
      }
    }

    this.ctx.startAutoResizer?.();
  }
}
