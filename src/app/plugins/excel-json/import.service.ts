// import.service.ts
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { buildClient, Client as DatoClient } from '@datocms/cma-client-browser';
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';

type TableRow = Record<string, string>;
type UploadLike = { upload_id?: string; __direct_url?: string } | null;

function isFileOrBlob(v: any): v is File | Blob {
  return typeof v === 'object' && v != null && (v instanceof Blob || (typeof File !== 'undefined' && v instanceof File));
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  // -------------------- small utils --------------------
  toStringValue(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && Number.isNaN(v)) return '';
    console.log(v, 'v')
    return String(v);
  }
  splitPath(path: string) { return path.split('.').filter(Boolean); }
  getAtPath(root: any, parts: string[]) { return parts.reduce((acc, k) => (acc ? acc[k] : undefined), root); }

  pickAnyLocaleValue(raw: any, locale?: string | null) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw ?? null;
    if (locale && Object.prototype.hasOwnProperty.call(raw, locale) && raw[locale]) return raw[locale];
    for (const k of Object.keys(raw)) if (raw[k]) return raw[k];
    return null;
  }

  resolveCurrentBlockContainer(ctx: RenderFieldExtensionCtx): { container: any; containerPath: string[] } | null {
    const root = (ctx as any).formValues;
    if (!root) return null;
    const parts = this.splitPath(ctx.fieldPath);
    if (ctx.locale && parts[parts.length - 1] === ctx.locale) parts.pop(); // drop locale suffix when present
    parts.pop(); // drop current field key
    const container = this.getAtPath(root, parts);
    if (!container || typeof container !== 'object') return null;
    return { container, containerPath: parts };
  }

  private makeSiblingFieldPath(ctx: RenderFieldExtensionCtx, siblingApiKey: string): string | null {
    const hit = this.resolveCurrentBlockContainer(ctx);
    if (!hit) return null;
    const { containerPath } = hit;

    const allDefs = Object.values(ctx.fields) as any[];
    const sibDef = allDefs.find((f: any) => (f.apiKey ?? f.attributes?.api_key) === siblingApiKey);
    const isLocalized = Boolean(sibDef?.localized ?? sibDef?.attributes?.localized);
    const key = sibDef?.id ? String(sibDef.id) : siblingApiKey;

    const base = [...containerPath, key];
    if (isLocalized && ctx.locale) base.push(ctx.locale);
    return base.join('.');
  }

  // -------------------- upload-like detection --------------------
  normalizeUploadLike(raw: any): UploadLike {
    if (!raw) return null;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!v) return null;
    if (v?.upload_id) return v;
    if (v?.upload?.id) return { upload_id: v.upload.id };
    if (typeof v === 'string' && v.startsWith('http')) return { __direct_url: v };
    return null;
  }

  findFirstUploadDeep(val: any): UploadLike {
    if (!val) return null;
    const candidate = this.normalizeUploadLike(val);
    if (candidate) return candidate;

    if (Array.isArray(val)) {
      for (const it of val) {
        const n = this.findFirstUploadDeep(it);
        if (n) return n;
      }
      return null;
    }
    if (typeof val === 'object') {
      for (const k of Object.keys(val)) {
        const n = this.findFirstUploadDeep((val as any)[k]);
        if (n) return n;
      }
    }
    return null;
  }

  findFirstFileOrBlobDeep(val: any): File | Blob | null {
    if (!val) return null;
    if (isFileOrBlob(val)) return val;

    if (Array.isArray(val)) {
      for (const it of val) {
        const n = this.findFirstFileOrBlobDeep(it);
        if (n) return n;
      }
      return null;
    }
    if (typeof val === 'object') {
      for (const k of Object.keys(val)) {
        const n = this.findFirstFileOrBlobDeep((val as any)[k]);
        if (n) return n;
      }
    }
    return null;
  }

  // -------------------- CMA client helpers --------------------
  private buildClientSmart(ctx: RenderFieldExtensionCtx | undefined, apiToken: string, withEnv: boolean): DatoClient {
    const env =
      (ctx && (ctx.plugin?.attributes?.parameters as any)?.environment) ||
      (ctx && (ctx as any)?.environment) ||
      undefined;
    return withEnv && env
      ? buildClient({ apiToken, environment: env })
      : buildClient({ apiToken });
  }

  private isNotFound(err: any): boolean {
    const code = err?.code || err?.data?.code || err?.response?.data?.code;
    const status = err?.status || err?.response?.status;
    return code === 'NOT_FOUND' || status === 404;
  }

  private async findUploadRobust(
    ctx: RenderFieldExtensionCtx | undefined,
    apiToken: string,
    uploadId: string,
    { maxMs = 7000, stepMs = 300 } = {}
  ): Promise<any> {
    const clientEnv = this.buildClientSmart(ctx, apiToken, true);
    const clientGlobal = this.buildClientSmart(ctx, apiToken, false);

    const start = Date.now();
    let triedGlobal = false;
    let lastErr: any = null;

    while (Date.now() - start < maxMs) {
      try {
        if (!triedGlobal) {
          const up = await clientEnv.uploads.find(String(uploadId));
          if (up?.url) return up;
        } else {
          const up = await clientGlobal.uploads.find(String(uploadId));
          if (up?.url) return up;
        }
      } catch (e) {
        lastErr = e;
        if (!triedGlobal && this.isNotFound(e)) triedGlobal = true; // env mismatch → try global
      }
      await new Promise(r => setTimeout(r, stepMs));
    }

    if (!triedGlobal) {
      try {
        const up = await clientGlobal.uploads.find(String(uploadId));
        if (up?.url) return up;
      } catch (e) { lastErr = e; }
    }
    throw new Error(`Upload ${uploadId} not reachable/ready. Last error: ${lastErr?.message || lastErr}`);
  }

  // -------------------- public API --------------------
  /**
   * Ensures the sibling field resolves to an UploadLike:
   * - If it already contains an upload/direct url → returns it
   * - If it contains a File/Blob → uploads via CMA, writes {upload_id} back into the field, returns it
   */
  async ensureUploadFromSibling(
    ctx: RenderFieldExtensionCtx,
    siblingApiKey: string,
    cmaToken: string
  ): Promise<UploadLike> {
    const hit = this.resolveCurrentBlockContainer(ctx);
    if (!hit) return null;
    const { container } = hit;

    const allDefs = Object.values(ctx.fields) as any[];
    const sibDef = allDefs.find((f: any) => (f.apiKey ?? f.attributes?.api_key) === siblingApiKey);
    const isLocalized = Boolean(sibDef?.localized ?? sibDef?.attributes?.localized);
    const sourcePath = this.makeSiblingFieldPath(ctx, siblingApiKey);

    const extract = (raw: any) => isLocalized ? this.pickAnyLocaleValue(raw, ctx.locale) : raw;

    const tryEnsure = async (raw: any): Promise<UploadLike> => {
      const existing = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
      if (existing) return existing;

      const file = this.findFirstFileOrBlobDeep(raw);
      if (!file) return null;
      if (!cmaToken) throw new Error('Missing CMA token: cannot upload local file.');

      const client = this.buildClientSmart(ctx, cmaToken, true);
      const created = await client.uploads.createFromFileOrBlob({ fileOrBlob: file });
      const ensured: UploadLike = { upload_id: String(created.id) };

      if (sourcePath) await ctx.setFieldValue(sourcePath, { upload_id: ensured.upload_id });
      return ensured;
    };

    // by id
    if (sibDef?.id && Object.prototype.hasOwnProperty.call(container, String(sibDef.id))) {
      const raw = extract(container[String(sibDef.id)]);
      const ensured = await tryEnsure(raw);
      if (ensured) return ensured;
    }
    // by apiKey
    if (Object.prototype.hasOwnProperty.call(container, siblingApiKey)) {
      const raw = extract(container[siblingApiKey]);
      const ensured = await tryEnsure(raw);
      if (ensured) return ensured;
    }
    // fallback
    for (const k of Object.keys(container)) {
      const defById = (ctx.fields as any)[k] || allDefs.find((f: any) => String(f.id) === String(k));
      const keyApi = defById ? (f => (f.apiKey ?? f.attributes?.api_key))(defById) : k;
      const raw = extract(container[k]);
      const ensured = await tryEnsure(raw);
      if (!ensured) continue;
      if (keyApi === siblingApiKey) return ensured;
      return ensured;
    }
    return null;
  }

  /**
   * Resolve upload metadata to a PUBLIC URL suitable for fetch/XLSX.
   * Retries briefly and falls back to a global client if env-scoped lookup says NOT_FOUND.
   */
  async fetchUploadMeta(
    fileFieldValue: UploadLike,
    cmaToken: string,
    ctx?: RenderFieldExtensionCtx
  ): Promise<{ url: string; mime: string | null; filename: string | null } | null> {
    if (fileFieldValue?.upload_id) {
      if (!cmaToken) throw new Error('Missing CMA token: cannot resolve upload metadata.');
      const up = await this.findUploadRobust(ctx, cmaToken, String(fileFieldValue.upload_id));
      return { url: up?.url || null, mime: up?.mime_type ?? null, filename: up?.filename ?? null };
    }
    if (fileFieldValue?.__direct_url) {
      const url: string = fileFieldValue.__direct_url;
      let filename: string | null = null;
      try { const u = new URL(url); filename = decodeURIComponent(u.pathname.split('/').pop() || ''); } catch {}
      return { url, mime: null, filename };
    }
    return null;
  }

  // -------------------- (optional) legacy shim --------------------
  getSiblingFileFromBlock(ctx: RenderFieldExtensionCtx, siblingApiKey: string): UploadLike {
    const hit = this.resolveCurrentBlockContainer(ctx);
    if (!hit) return null;
    const { container } = hit;

    const allDefs = Object.values(ctx.fields) as any[];
    const sibDef = allDefs.find((f: any) => (f.apiKey ?? f.attributes?.api_key) === siblingApiKey);
    const isLocalized = Boolean(sibDef?.localized ?? sibDef?.attributes?.localized);

    const pick = (v: any) => isLocalized ? this.pickAnyLocaleValue(v, ctx.locale) : v;

    if (sibDef?.id && Object.prototype.hasOwnProperty.call(container, String(sibDef.id))) {
      const raw = pick(container[String(sibDef.id)]);
      const norm = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
      if (norm) return norm;
    }
    if (Object.prototype.hasOwnProperty.call(container, siblingApiKey)) {
      const raw = pick(container[siblingApiKey]);
      const norm = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
      if (norm) return norm;
    }
    for (const k of Object.keys(container)) {
      const defById = (ctx.fields as any)[k] || allDefs.find((f: any) => String(f.id) === String(k));
      const keyApi = defById ? (f => (f.apiKey ?? f.attributes?.api_key))(defById) : k;
      const raw = pick(container[k]);
      const norm = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
      if (!norm) continue;
      if (keyApi === siblingApiKey) return norm;
    }
    return null;
  }

  // -------------------- AoA builder (NO date formatting at all) --------------------
  /**
   * Returns a plain array-of-arrays from a worksheet without any date conversion/formatting.
   * We read RAW values and keep everything as the library gives it:
   * - Numbers stay numbers (including Excel date serials)
   * - Strings stay strings (including long date strings)
   * - Empty cells become ''
   */
  aoaFromWorksheet(ws: XLSX.WorkSheet): any[][] {
    return XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: true
      // no dateNF, no cellDates — deliberately NOT formatting dates
    }) as any[][];
  }

  // -------------------- AoA -> rows/columns --------------------
  normalizeAoA(aoa: any[][]) {
    if (!aoa.length) return { rows: [] as TableRow[], columns: [] as string[] };

    const header = aoa[0] ?? [];
    const body = aoa.slice(1);

    let columns = header.map((h, i) => this.slugHeader(h, `column_${i + 1}`));
    const maxCols = Math.max(columns.length, ...body.map((r) => r.length), 1);
    while (columns.length < maxCols) columns.push(`column_${columns.length + 1}`);
    columns = this.makeUnique(columns);

    const rows: TableRow[] = body.map((r) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = this.toStringValue(r[i]);
      }
      return obj;
    });

    return { rows, columns };
  }

  slugHeader(raw: unknown, fallback: string) {
    let s = this.toStringValue(raw).trim();
    if (!s) return fallback;
    s = s.replace(/[^\p{L}\p{N}\s_-]+/gu, '').trim().replace(/\s+/g, '_');
    s = s.replace(/^_+/, '');
    if (/^\d/.test(s) || !s) return fallback;
    return s;
  }

  makeUnique(names: string[]) {
    const seen = new Map<string, number>();
    return names.map((n) => {
      const base = n;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return count === 1 ? base : `${base}_${count}`;
    });
  }
}
