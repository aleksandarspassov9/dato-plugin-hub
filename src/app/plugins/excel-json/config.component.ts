import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dato-excel-config',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap">
      <label for="cmaToken">CMA API Token (Uploads: read; Items: write + publish for Save & Publish)</label>
      <input id="cmaToken" type="text" [value]="token" (input)="token = ($any($event.target).value)" />
      <button (click)="save()">Save configuration</button>
    </div>
  `,
  styles: [`
    .wrap { display:flex; flex-direction:column; gap:8px; font:inherit; }
    input { padding:8px; border:1px solid var(--border-color); border-radius:6px; }
    button { padding:8px 12px; border-radius:6px; border:1px solid var(--border-color); background:#0b5fff; color:#fff; }
  `]
})
export class ConfigComponent {
  ctx!: any;
  token = '';

  ngOnInit() {
    console.log('test')
    this.token = (this.ctx.plugin?.attributes?.parameters as any)?.cmaToken || '';
  }

  async save() {
    await this.ctx.updatePluginParameters({ cmaToken: this.token });
    this.ctx.notice('Saved plugin configuration.');
  }
}
