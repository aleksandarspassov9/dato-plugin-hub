// src/dato/dato-bridge.ts
import { connect, RenderFieldExtensionCtx, Field } from 'datocms-plugin-sdk';

const FIELD_EXTENSION_ID = 'chart-viewer';

// Helper: decide where your extension shows up.
// Easiest path: make it a **manual** field extension in Dato (recommended).
// If you prefer forcing it programmatically, you can keep this override.
function shouldAttachToField(field: Field) {
  // Attach only to Modular Content or Single Block fields; you’ll still filter for "chart" at runtime
  return field.attributes.field_type === 'rich_text' || field.attributes.field_type === 'single_block';
}

connect({
  // (Optional) Force the extension on specific field types
  overrideFieldExtensions(field: Field, _ctx: any) {
    if (shouldAttachToField(field)) {
      // Choose editor OR addon; editor replaces the default editor, addon renders below the field
      return { addons: [{ id: FIELD_EXTENSION_ID }] };
    }
  },

  // Render our Angular app for the extension
  renderFieldExtension(fieldExtensionId: string, ctx: RenderFieldExtensionCtx) {
    if (fieldExtensionId !== FIELD_EXTENSION_ID) return;

    // Let Angular know/refresh the ctx each time Dato re-renders us
    window.dispatchEvent(new CustomEvent('datocms:ctx', { detail: ctx }));

    // Keep iframe height in sync
    ctx.startAutoResizer();
  },
});
