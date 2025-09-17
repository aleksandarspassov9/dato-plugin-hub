// src/app/services/datocms.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Types are runtime-only here to keep it simple
type Ctx = any;

function deepGet(obj: any, path: string) {
  return path.split('.').reduce((a, p) => (a ? a[p] : undefined), obj);
}

// Tries to extract a "chart" block from the current field value
function pickChartBlock(fieldValue: any) {
  console.log(fieldValue)
  if (!fieldValue) return null;

  // If Single Block, value is already the block/object
  if (!Array.isArray(fieldValue)) {
    // Accept when the block type looks like "chart"
    if (
      fieldValue?.itemType?.api_key === 'chart' ||
      fieldValue?.blockType?.api_key === 'chart' ||
      fieldValue?.type === 'chart'
    ) {
      return fieldValue;
    }
    return null;
  }

  // If Modular Content (array), find the first "chart" block
  return fieldValue.find(
    (b: any) =>
      b?.itemType?.api_key === 'chart' ||
      b?.blockType?.api_key === 'chart' ||
      b?.type === 'chart'
  ) || null;
}

@Injectable({ providedIn: 'root' })
export class DatocmsService {
  // Raw Dato ctx
  readonly ctx$ = new BehaviorSubject<Ctx | null>(null);

  // Whatever we consider the "chart" block’s data
  readonly chartData$ = new BehaviorSubject<any>(null);

  constructor() {
    // Listen to ctx messages from the bridge
    window.addEventListener('datocms:ctx', (e: Event) => {
      const ctx = (e as CustomEvent).detail;
      this.ctx$.next(ctx);

      const value = deepGet(ctx.formValues, ctx.fieldPath); // current field value
      this.chartData$.next(pickChartBlock(value));
    });
  }
}
