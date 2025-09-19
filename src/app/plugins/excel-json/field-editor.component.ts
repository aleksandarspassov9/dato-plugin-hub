import { Component, Input, ChangeDetectionStrategy, NgZone } from '@angular/core';
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';
import { ImportService } from './import.service';
import * as XLSX from 'xlsx';


type FieldParams = {
  sourceFileApiKey?: string;
  columnsMetaApiKey?: string;
  rowCountApiKey?: string;
};

const DEFAULT_SOURCE_FILE_API_KEY = 'sourcefile';
const PAYLOAD_SHAPE: 'matrix' | 'rows' = 'matrix';

// global: last processed signature per block path+locale
const LAST_SIG_BY_BLOCK = new Map<string, string>();
// Tracks whether we've taken the initial snapshot for a block
const FIRST_SCAN_DONE = new Map<string, boolean>();

@Component({
    selector: 'dato-excel-editor',
    standalone: true,
    imports: [],
    template: `
    <div class="wrap">
      @if (busy) {
        <div class="spinner">Loading…</div>
      }
      @if (notice) {
        <div class="alert">{{ notice }}</div>
      }
      @if (!busy && !notice) {
        <div class="hint">
          Upload/replace the file in this block’s <code>{{sourceApiKey}}</code> field — import runs automatically.
        </div>
      }
    </div>
    `,
    styles: [`
    .wrap { font: inherit; }
    .alert { padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; margin-top:8px; }
    .hint { opacity:.7; font-size:12px; margin-top:4px; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldEditorComponent {
  @Input() ctx!: RenderFieldExtensionCtx;

  busy = false;
  notice: string | null = null;
  sourceApiKey = DEFAULT_SOURCE_FILE_API_KEY;

  private pollId: number | null = null;
  private lastLocalSig: string | null = null;

  constructor(private svc: ImportService, private zone: NgZone) {}

  ngOnInit(): void {
    const params = this.getParams(this.ctx);
    this.sourceApiKey = params.sourceFileApiKey || DEFAULT_SOURCE_FILE_API_KEY;

    // Poll for changes only; first tick establishes a baseline (no import)
    this.zone.runOutsideAngular(() => {
      this.pollId = window.setInterval(() => this.tick(), 800);
    });
  }

  ngOnDestroy(): void {
    if (this.pollId) window.clearInterval(this.pollId);
  }

  private getParams(ctx: RenderFieldExtensionCtx): FieldParams {
    const direct = (ctx.parameters as any) || {};
    if (direct && Object.keys(direct).length) return direct;
    const appearance =
      (ctx.field as any)?.attributes?.appearance?.parameters ||
      (ctx as any)?.fieldAppearance?.parameters || {};
    return appearance;
  }

  private blockKey(): string | null {
    const hit = this.svc.resolveCurrentBlockContainer(this.ctx);
    if (!hit) return null;
    return [...hit.containerPath, this.ctx.locale || ''].join('|');
  }

  private fileSignature(fileVal: any): string | null {
    if (!fileVal) return null;
    if (fileVal.upload_id) return `upload:${fileVal.upload_id}`;
    if (fileVal.__direct_url) return `url:${fileVal.__direct_url}`;
    return null;
  }

  private async tick() {
    try {
      const fileVal = this.svc.getSiblingFileFromBlock(this.ctx, this.sourceApiKey);
      const sig = this.fileSignature(fileVal);        // string | null
      const bkey = this.blockKey();                   // block+locale key
      if (!bkey) return;

      const firstDone = FIRST_SCAN_DONE.get(bkey) === true;
      const prevSig  = LAST_SIG_BY_BLOCK.get(bkey) ?? null;

      // 1) First scan: just record the baseline, never import
      if (!firstDone) {
        LAST_SIG_BY_BLOCK.set(bkey, sig ?? '__NULL__');
        FIRST_SCAN_DONE.set(bkey, true);
        this.lastLocalSig = sig ?? null;
        return;
      }

      // 2) No change since last tick
      const normalizedSig = sig ?? '__NULL__';
      if (normalizedSig === (prevSig ?? '__NULL__') || this.busy) return;

      // 3) Change detected
      LAST_SIG_BY_BLOCK.set(bkey, normalizedSig);
      this.lastLocalSig = sig ?? null;

      // 3a) File removed → optional clear
      if (sig == null) {
        await this.handleRemoval(bkey);
        return;
      }

      // 3b) File added/changed → import
      await this.importFromFile(fileVal, bkey);
    } catch {
      // swallow polling errors
    }
  }

  // Clear the JSON (and optional sibling metas) when file is removed
  private async handleRemoval(bkey: string) {
    // Toggle this to false if you do NOT want to auto-clear on removal
    const CLEAR_ON_REMOVE = true;

    if (!CLEAR_ON_REMOVE) return;

    this.zone.run(() => { this.busy = true; this.notice = null; });
    try {
      await this.ctx.setFieldValue(this.ctx.fieldPath, null);
      await Promise.resolve();
      await this.ctx.setFieldValue(this.ctx.fieldPath, JSON.stringify({
        columns: [],
        data: [],
        meta: { filename: null, mime: null, imported_at: new Date().toISOString(), removed: true }
      }));
      this.ctx.notice?.('File removed: cleared imported data.');
    } finally {
      this.zone.run(() => { this.busy = false; });
    }
  }

  private async importFromFile(fileVal: any, bkey: string) {
    this.zone.run(() => { this.busy = true; this.notice = null; });
    try {
      const token = (this.ctx.plugin.attributes.parameters as any)?.cmaToken || '';
      const meta = await this.svc.fetchUploadMeta(fileVal, token);
      if (!meta?.url) throw new Error('Could not resolve upload URL. Add a CMA token with "Uploads: read".');
      if (meta.mime && meta.mime.startsWith('image/')) throw new Error(
        `"${meta.filename ?? 'selected file'}" looks like an image (${meta.mime}). Please upload an Excel/CSV file.`
      );

      const bust = Date.now();
      const res = await fetch(meta.url + (meta.url.includes('?') ? '&' : '?') + `cb=${bust}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

      const ct = (res.headers.get('content-type') || meta.mime || '').toLowerCase();
      let aoa: any[][];
      if (ct.includes('csv')) {
        const text = await res.text();
        const wb = XLSX.read(text, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        aoa = this.svc.aoaFromWorksheet(ws);
      } else {
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        aoa = this.svc.aoaFromWorksheet(ws);
      }

      const norm = this.svc.normalizeAoA(aoa);
      const payloadObj = (PAYLOAD_SHAPE === 'matrix')
        ? {
            columns: norm.columns,
            data: norm.rows.map(r => norm.columns.map(c => (r as any)[c] ?? '')),
            meta: { filename: meta.filename ?? null, mime: meta.mime ?? null, imported_at: new Date().toISOString(), nonce: bust },
          }
        : {
            rows: norm.rows,
            meta: { filename: meta.filename ?? null, mime: meta.mime ?? null, imported_at: new Date().toISOString(), nonce: bust },
          };

      await this.ctx.setFieldValue(this.ctx.fieldPath, null);
      await Promise.resolve();
      await this.ctx.setFieldValue(this.ctx.fieldPath, JSON.stringify(payloadObj));

      const params = this.getParams(this.ctx);
      if (params.columnsMetaApiKey && PAYLOAD_SHAPE === 'matrix') {
        await this.setSiblingInBlock(params.columnsMetaApiKey, { columns: norm.columns });
      }
      if (params.rowCountApiKey) {
        await this.setSiblingInBlock(params.rowCountApiKey, Number(norm.rows.length));
      }

      this.ctx.notice(`Imported ${norm.rows.length} rows × ${norm.columns.length} columns.`);
    } catch (e: any) {
      LAST_SIG_BY_BLOCK.delete(bkey);
      this.zone.run(() => this.notice = `Import failed: ${e?.message || e}`);
    } finally {
      this.zone.run(() => this.busy = false);
    }
  }

  private async setSiblingInBlock(apiKey: string, value: any) {
    const hit = this.svc.resolveCurrentBlockContainer(this.ctx);
    if (!hit) return;
    const { containerPath } = hit;

    const allDefs = Object.values(this.ctx.fields) as any[];
    const def = allDefs.find((f: any) => (f.apiKey ?? f.attributes?.api_key) === apiKey);

    const key = def?.id ? String(def.id) : apiKey;
    const isLocalized = Boolean(def?.localized ?? def?.attributes?.localized);
    const path = [...containerPath, key, ...(isLocalized && this.ctx.locale ? [this.ctx.locale] : [])].join('.');

    await this.ctx.setFieldValue(path, value);
  }
}
