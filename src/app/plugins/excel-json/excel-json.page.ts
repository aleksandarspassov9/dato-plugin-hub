import { Component, Injector, OnInit } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { connect, type RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { FieldEditorComponent } from './field-editor.component';
import { ConfigComponent } from './config.component';

@Component({
  selector: 'app-excel-json-page',
  standalone: true,
  template: `<div id="root" style="height:100%"></div>`,
  styles: [':host{display:block;height:100%}'],
})
export class ExcelJsonPageComponent implements OnInit {
  constructor(private injector: Injector) {}

  ngOnInit(): void {
    if (!customElements.get('dato-excel-editor')) {
      customElements.define(
        'dato-excel-editor',
        createCustomElement(FieldEditorComponent, { injector: this.injector })
      );
    }
    if (!customElements.get('dato-excel-config')) {
      customElements.define(
        'dato-excel-config',
        createCustomElement(ConfigComponent, { injector: this.injector })
      );
    }

    const root = document.getElementById('root')!;
    if (window.self === window.top) {
      root.innerHTML = `
        <div style="padding:16px">
          <h3>Excel → JSON plugin route</h3>
          <p>Open this URL from DatoCMS (Plugin URL) to see the editor.</p>
        </div>
      `;
    }

    connect({
      renderConfigScreen: (ctx: any) => {
        root.innerHTML = '';
        const el = document.createElement('dato-excel-config') as any;
        el.ctx = ctx;
        root.appendChild(el);
      },
      manualFieldExtensions() {
        return [{
          id: 'excelJsonUploaderBlockOnly',
          name: 'Excel → JSON (Block Only)',
          type: 'editor',
          fieldTypes: ['json', 'text'],
          parameters: [
            { id: 'sourceFileApiKey', name: 'Sibling file field API key', type: 'string', required: true, help_text: 'Usually "sourcefile".' },
            { id: 'columnsMetaApiKey', name: 'Sibling meta field for columns (optional)', type: 'string' },
            { id: 'rowCountApiKey', name: 'Sibling meta field for row count (optional)', type: 'string' },
          ],
        }];
      },
      renderFieldExtension: (id: string, ctx: RenderFieldExtensionCtx) => {
        if (id !== 'excelJsonUploaderBlockOnly') return;
        root.innerHTML = '';
        const el = document.createElement('dato-excel-editor') as any;
        el.ctx = ctx;
        root.appendChild(el);
      },
    });
  }
}
