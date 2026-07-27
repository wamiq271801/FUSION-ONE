/**
 * PDF renderer — server-only.
 * Generates a PDF buffer from InvoiceData using @react-pdf/renderer.
 */
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { getPdfTemplate } from '../registry';
import type { InvoiceData, TemplateVariant } from '../types';

export async function renderPdf(data: InvoiceData): Promise<Buffer> {
  const Template = getPdfTemplate((data.template as TemplateVariant) || 'prestige');
  const element = React.createElement(Template, { data });
  const stream = await renderToStream(element as any);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
