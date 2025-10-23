import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { buildClient } from '@datocms/cma-client-browser';
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk';

type TableRow = Record<string, string>;
type UploadLike = { upload_id?: string; __direct_url?: string } | null;

// Narrow DOM availability for Node typings; in browsers these exist.
function isFileOrBlob(v: any): v is File | Blob {
  return typeof v === 'object' && v != null && (v instanceof Blob || (typeof File !== 'undefined' && v instanceof File));
}

@Injectable({ providedIn: 'root' })
export class ImportService {
  // -------------------- small utils --------------------
  toStringValue(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && Number.isNaN(v)) return '';
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
    if (ctx.locale && parts[parts.length - 1] === ctx.locale) parts.pop(); // drop locale suffix if present
    parts.pop(); // drop current field key
    const container = this.getAtPath(root, parts);
    if (!container || typeof container !== 'object') return null;
    return { container, containerPath: parts };
  }

  /** Build a path to a sibling field inside the same block, respecting id/apiKey addressing and locale. */
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

  /** Find first File/Blob deep in a structure (used when a brand-new file was selected). */
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

  /**
   * Ensure we have an UploadLike:
   * - If we already have an upload id/direct url, return it
   * - If a File/Blob exists, upload to Dato and return { upload_id }
   * - If we uploaded from a File/Blob, optionally write { upload_id } back into the source field
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

    // 1) Try by id-key
    if (sibDef?.id && Object.prototype.hasOwnProperty.call(container, String(sibDef.id))) {
      const raw = extract(container[String(sibDef.id)]);
      const ensured = await this.ensureUploadLike(raw, cmaToken);
      // If we uploaded from a local File/Blob, persist the { upload_id } in the block
      if (ensured?.upload_id && sourcePath && isFileOrBlob(raw)) {
        await ctx.setFieldValue(sourcePath, { upload_id: ensured.upload_id });
      }
      if (ensured) return ensured;
    }

    // 2) Try by apiKey
    if (Object.prototype.hasOwnProperty.call(container, siblingApiKey)) {
      const raw = extract(container[siblingApiKey]);
      const ensured = await this.ensureUploadLike(raw, cmaToken);
      if (ensured?.upload_id && sourcePath && isFileOrBlob(raw)) {
        await ctx.setFieldValue(sourcePath, { upload_id: ensured.upload_id });
      }
      if (ensured) return ensured;
    }

    // 3) Fallback scan
    let fallback: UploadLike = null;
    for (const k of Object.keys(container)) {
      const defById = (ctx.fields as any)[k] || allDefs.find((f: any) => String(f.id) === String(k));
      const keyApi = defById ? (defById.apiKey ?? defById.attributes?.api_key) : k;
      const raw = extract(container[k]);
      const ensured = await this.ensureUploadLike(raw, cmaToken);
      if (!ensured) continue;
      if (keyApi === siblingApiKey) return ensured;
      if (!fallback) fallback = ensured;
    }
    return fallback;
  }

  /** Core: if already an upload, return it; if a File/Blob, upload it first. */
  async ensureUploadLike(raw: any, cmaToken: string): Promise<UploadLike> {
    const existing = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
    if (existing) return existing;

    const file = this.findFirstFileOrBlobDeep(raw);
    if (!file) return null;
    if (!cmaToken) throw new Error('Missing CMA token for uploading file to DatoCMS');

    const client = buildClient({ apiToken: cmaToken });
    const upload = await client.uploads.createFromFileOrBlob({
      fileOrBlob: file,
      // filename: (file as File).name, // optional hint
    });

    return { upload_id: String(upload.id) };
  }

  /**
   * Legacy synchronous getter (kept for compatibility).
   * NOTE: This will NOT see a brand-new File/Blob before it’s uploaded; prefer ensureUploadFromSibling().
   */
  getSiblingFileFromBlock(ctx: RenderFieldExtensionCtx, siblingApiKey: string): UploadLike {
    const hit = this.resolveCurrentBlockContainer(ctx);
    console.log(hit, 'hit');
    if (!hit) return null;
    const { container } = hit;

    const allDefs = Object.values(ctx.fields) as any[];
    const sibDef = allDefs.find((f: any) => (f.apiKey ?? f.attributes?.api_key) === siblingApiKey);
    const isLocalized = Boolean(sibDef?.localized ?? sibDef?.attributes?.localized);

    if (sibDef?.id && Object.prototype.hasOwnProperty.call(container, String(sibDef.id))) {
      const raw = isLocalized ? this.pickAnyLocaleValue(container[String(sibDef.id)], ctx.locale) : container[String(sibDef.id)];
      const norm = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
      if (norm) return norm;
    }
    if (Object.prototype.hasOwnProperty.call(container, siblingApiKey)) {
      const raw = isLocalized ? this.pickAnyLocaleValue(container[siblingApiKey], ctx.locale) : container[siblingApiKey];
      const norm = this.normalizeUploadLike(raw) || this.findFirstUploadDeep(raw);
      if (norm) return norm;
    }

    let fallback: UploadLike = null;
    for (const k of Object.keys(container)) {
      const defById = (ctx.fields as any)[k] || allDefs.find((f: any) => String(f.id) === String(k));
      const keyApi = defById ? (defById.apiKey ?? defById.attributes?.api_key) : k;
      const val = this.pickAnyLocaleValue(container[k], ctx.locale);
      const norm = this.normalizeUploadLike(val) || this.findFirstUploadDeep(val);
      if (!norm) continue;
      if (keyApi === siblingApiKey) return norm;
      if (!fallback) fallback = norm;
    }
    return fallback;
  }

  // -------------------- xlsx helpers --------------------
  aoaFromWorksheet(ws: XLSX.WorkSheet): any[][] {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    return aoa.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
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

  normalizeAoA(aoa: any[][]) {
    if (!aoa.length) return { rows: [] as TableRow[], columns: [] as string[] };

    const header = aoa[0] ?? [];
    const body = aoa.slice(1);

    let columns = header.map((h, i) => this.slugHeader(h, `column_${i + 1}`));
    const maxCols = Math.max(columns.length, ...body.map((r) => r.length), 1);
    while (columns.length < maxCols) columns.push(`column_${columns.length + 1}`);
    columns = this.makeUnique(columns);

    const rows: TableRow[] = body.map((r) => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push('');
      const obj: Record<string, string> = {};
      columns.forEach((c, i) => { obj[c] = this.toStringValue(padded[i]); });
      return obj;
    });

    return { rows, columns };
  }

  // -------------------- DatoCMS upload meta --------------------
  async fetchUploadMeta(
    fileFieldValue: UploadLike,
    cmaToken: string
  ): Promise<{ url: string; mime: string | null; filename: string | null } | null> {
    if (fileFieldValue?.upload_id) {
      if (!cmaToken) return null;
      const client = buildClient({ apiToken: cmaToken });
      console.log(fileFieldValue, 'fileFieldValue');
      const upload: any = await client.uploads.find(String(fileFieldValue.upload_id));
      // IMPORTANT: use the public asset URL returned by the CMA (datocms-assets.com), not site-api/uploads/:id
      return { url: upload?.url || null, mime: upload?.mime_type ?? null, filename: upload?.filename ?? null };
    }
    if (fileFieldValue?.__direct_url) {
      const url: string = fileFieldValue.__direct_url;
      let filename: string | null = null;
      try { const u = new URL(url); filename = decodeURIComponent(u.pathname.split('/').pop() || ''); } catch {}
      return { url, mime: null, filename };
    }
    return null;
  }
}
