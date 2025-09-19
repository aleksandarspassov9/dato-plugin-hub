import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

// helpers
function deepGet(obj: any, path: string | string[]) {
  if (!obj || !path) return undefined;
  const parts = Array.isArray(path) ? path : String(path).split('.');
  return parts.reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function pickChartBlock(value: any, blockApiKey = 'chart') {
  if (!value) return null;

  // Single block field?
  if (!Array.isArray(value)) {
    const typeKey =
      value?.itemType?.api_key || value?.blockType?.api_key || value?.type || value?.__typename;
    return typeKey === blockApiKey ? value : null;
  }

  // Modular content: find first block with api_key = 'chart'
  return (
    value.find(
      (b: any) =>
        b?.itemType?.api_key === blockApiKey ||
        b?.blockType?.api_key === blockApiKey ||
        b?.type === blockApiKey
    ) || null
  );
}

@Component({
    selector: 'dato-chart-preview',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div style="padding:16px; font:inherit;">
      <h3 style="margin:0 0 8px;">Chart block preview</h3>
    
      @if (chartBlock) {
        <p style="opacity:.8; margin:0 0 8px;">Received <code>{{ apiKey }}</code> block:</p>
        <pre style="padding:12px; background:#f6f6f6; border-radius:8px; overflow:auto;">
          {{ chartBlock | json }}
        </pre>
      } @else {
        <em style="opacity:.8">Waiting for DatoCMS context or no <code>{{ apiKey }}</code> block found in this field…</em>
      }
    
    </div>
    `
})
export class ChartPreviewComponent implements OnChanges {
  /** Dato render context, passed in from the page component */
  @Input() ctx: any;

  chartBlock: any = null;
  apiKey = 'chart';

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ctx) return;

    // const chartPreviewData = this.ctx.formValues?.components.map(c => {
    //   if (Object.hasOwn(c, 'chart_preview')) {
    //     return c
    //   }
    // })

    const chartPreviewDataIndex = this.ctx.formValues?.components.findIndex(c => Object.hasOwn(c, 'chart_preview'))
    const chartPreviewData = this.ctx.formValues?.components[chartPreviewDataIndex]
    console.log(console.log(chartPreviewData))

    // Allow plugin param override for block api key
    const params = this.ctx?.plugin?.attributes?.parameters ?? {};
    this.apiKey = params?.blockApiKey || 'chart';

    // Read current field's value
    const value = deepGet(this.ctx.formValues, this.ctx.fieldPath);

    // Extract the chart block
    this.chartBlock = pickChartBlock(value, this.apiKey);

    // Make sure height adapts (if not already started by the page)
    this.ctx.startAutoResizer?.();
  }
}
