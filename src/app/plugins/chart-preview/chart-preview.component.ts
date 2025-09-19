import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ChartComponent } from './chart/chart.component';

// helpers
function deepGet(obj: any, path: string | string[]) {
  if (!obj || !path) return undefined;
  const parts = Array.isArray(path) ? path : String(path).split('.');
  return parts.reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

@Component({
    selector: 'dato-chart-preview',
    standalone: true,
    imports: [CommonModule, ButtonModule, ChartComponent],
    template: `
    <div style="padding:16px; font:inherit;">

      <h3 style="margin:0 0 8px;">Chart block preview</h3>

      @if (chartData) {
        <gfp-chart-component [data]="chartData"></gfp-chart-component>
      } @else {
        <em style="opacity:.8">Waiting for DatoCMS context or no <code>{{ apiKey }}</code> block found in this field…</em>
      }

    </div>
    `
})
export class ChartPreviewComponent implements OnChanges {
  /** Dato render context, passed in from the page component */
  @Input() ctx: any;

  apiKey = 'chart';
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
        data: {
          attributes: chartPreviewData.data,
        },
        aspect_ratio: chartPreviewData.aspect_ratio
      }
    }

    // Allow plugin param override for block api key
    const params = this.ctx?.plugin?.attributes?.parameters ?? {};
    this.apiKey = params?.blockApiKey || 'chart';

    // Make sure height adapts (if not already started by the page)
    this.ctx.startAutoResizer?.();
  }
}
