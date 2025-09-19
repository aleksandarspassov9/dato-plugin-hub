import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
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
export class ChartPreviewComponent implements OnChanges, OnDestroy {
  @Input() ctx: any;

  chartData: any | undefined; // undefined until ready
  private debounceTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(_: SimpleChanges): void {
    // cancel any pending run
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // schedule after idle
    this.debounceTimer = setTimeout(() => this.applyChangesSafe(), 300);
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private applyChangesSafe(): void {
    // Validate ctx & components
    const components = this.ctx?.formValues?.components;
    if (!Array.isArray(components)) {
      this.chartData = undefined;
      return;
    }

    const item = components.find((c: any) =>
      c && Object.prototype.hasOwnProperty.call(c, 'chart_preview')
    );
    if (!item) {
      this.chartData = undefined;
      return;
    }

    // Build chart data defensively
    const { title, chart_type, labels, data, aspect_ratio } = item;
    this.chartData = {
      attributes: {
        title: title ?? '',
        chart_type: chart_type ?? 'bar',
        labels: labels ?? [],
        data: data ?? [],
        aspect_ratio: Number(aspect_ratio) || 2,
      }
    };

    this.ctx?.startAutoResizer?.();
  }
}
