import { AfterViewInit, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'dato-excel-config',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="wrap">
      <h3>Config</h3>

      <label for="cmaToken">CMA API Token (Uploads: read)</label>
      <input
        id="cmaToken"
        type="text"
        [value]="token"
        (input)="token = ($any($event.target).value)"
      />

      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="primary"  (click)="save()" [disabled]="saving">
          {{ saving ? 'Saving…' : 'Save configuration' }}
        </button>
        <span *ngIf="message" style="opacity:.8">{{ message }}</span>
      </div>
    </div>
  `,
    styles: [`
    .wrap { display:flex; flex-direction:column; gap:8px; font:inherit; padding:16px; }
    input { padding:8px; border:1px solid #dcdcdc; border-radius:6px; }
    button { padding:8px 12px; border-radius:6px; border:1px solid #dcdcdc; background:#0b5fff; color:#fff; }
  `]
})
export class ConfigComponent implements AfterViewInit {
  private _ctx: any;

  @Input() set ctx(v: any) {
    this._ctx = v;
    const params = v?.plugin?.attributes?.parameters as any;
    this.token = params?.cmaToken || '';
  }

  get ctx() { return this._ctx; }

  ngAfterViewInit() {
    this.ctx.updateHeight(220);
  }

  token = '';
  saving = false;
  message = '';

  async save() {
    if (!this.ctx) { this.message = 'Context not ready'; return; }
    try {
      this.saving = true;
      this.message = '';
      await this.ctx.updatePluginParameters({ cmaToken: this.token });
      this.ctx.notice?.('Saved plugin configuration.');
      this.message = 'Saved ✅';
    } catch (e: any) {
      console.error(e);
      this.message = `Save failed: ${e?.message || e}`;
    } finally {
      this.saving = false;
    }
  }
}
