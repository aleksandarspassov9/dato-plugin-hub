import { Component, Injector, OnInit } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { connect, type RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { ChartPreviewComponent } from './chart-preview.component';
import { ConfigComponent } from '../excel-json/config.component';


@Component({
  selector: 'app-chart-preview-page',
  standalone: true,
  template: `<div id="root" style="height:100%"></div>`,
  styles: [':host{display:block;height:100%}'],
})
export class ChartPreviewPageComponent implements OnInit {
  constructor(private injector: Injector) {}

  ngOnInit(): void {
    // Register custom elements (idempotent)
    if (!customElements.get('dato-chart-preview')) {
      customElements.define(
        'dato-chart-preview',
        createCustomElement(ChartPreviewComponent, { injector: this.injector })
      );
    }
    if (!customElements.get('dato-chart-config')) {
      // Alias your ConfigComponent so it can be reused here
      customElements.define(
        'dato-chart-config',
        createCustomElement(ConfigComponent, { injector: this.injector })
      );
    }

    const root = document.getElementById('root')!;
    if (window.self === window.top) {
      root.innerHTML = `
        <div style="padding:16px">
          <h3>Chart Preview plugin route</h3>
          <p>Open this URL from DatoCMS (Plugin URL) to see the extension.</p>
        </div>
      `;
    }

    connect({
      // Plugin configuration UI (reuses your ConfigComponent)
      renderConfigScreen: (ctx: any) => {
        root.innerHTML = '';
        const el = document.createElement('dato-chart-config') as any;
        el.ctx = ctx;
        root.appendChild(el);
      },

      // Make the field extension available in Dato
      manualFieldExtensions() {
        return [
          {
            id: 'chartPreviewBlockOnly',
            name: 'Chart Preview (Block Only)',
            type: 'addon',                 // renders below the field; switch to 'editor' to replace the field
            fieldTypes: ['rich_text', 'json', 'text'], // attach to the field that contains the chart block
            parameters: [
              // Optional: if you later want to parameterize which block api_key to read, add here
              { id: 'blockApiKey', name: 'Block API key', type: 'string', required: false, help_text: 'Default: "chart"' },
            ],
          },
        ];
      },

      // Mount the Angular Element when Dato renders the extension
      renderFieldExtension: (id: string, ctx: RenderFieldExtensionCtx) => {
        if (id !== 'chartPreviewBlockOnly') return;
        root.innerHTML = '';
        const el = document.createElement('dato-chart-preview') as any;
        el.ctx = ctx;
        root.appendChild(el);

        // Keep iframe height in sync (prevents "white screen" from 0px iframes)
        ctx.startAutoResizer?.();
      },
    });
  }
}
