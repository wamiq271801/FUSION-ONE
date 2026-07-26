/**
 * Central invoice template registry.
 * Maps template variant keys to both PDF components and HTML file paths.
 */
import path from 'path';
import type { InvoiceData, TemplateVariant } from './types';

import PrestigeTemplate from './templates/pdf/Prestige';
import ClassicTemplate  from './templates/pdf/Classic';
import MinimalTemplate  from './templates/pdf/Minimal';
import RetailTemplate   from './templates/pdf/Retail';
import ExecutiveTemplate from './templates/pdf/Executive';
import HeritageTemplate from './templates/pdf/Heritage';

type PdfTemplateComponent = React.ComponentType<{ data: InvoiceData }>;

const pdfRegistry: Record<TemplateVariant, PdfTemplateComponent> = {
  prestige:  PrestigeTemplate,
  classic:   ClassicTemplate,
  minimal:   MinimalTemplate,
  retail:    RetailTemplate,
  executive: ExecutiveTemplate,
  heritage:  HeritageTemplate,
};

const HTML_DIR = path.join(process.cwd(), 'lib', 'invoice', 'templates', 'html');

const htmlRegistry: Record<TemplateVariant, string> = {
  prestige:  path.join(HTML_DIR, 'Prestige.html'),
  classic:   path.join(HTML_DIR, 'Classic.html'),
  minimal:   path.join(HTML_DIR, 'Minimal.html'),
  retail:    path.join(HTML_DIR, 'Retail.html'),
  executive: path.join(HTML_DIR, 'Executive.html'),
  heritage:  path.join(HTML_DIR, 'Heritage.html'),
};

export function getPdfTemplate(variant: TemplateVariant): PdfTemplateComponent {
  const T = pdfRegistry[variant];
  if (!T) throw new Error(`Unknown template variant: ${variant}`);
  return T;
}

export function getHtmlTemplatePath(variant: TemplateVariant): string {
  const p = htmlRegistry[variant];
  if (!p) throw new Error(`Unknown template variant: ${variant}`);
  return p;
}

export const availableTemplates: TemplateVariant[] = Object.keys(pdfRegistry) as TemplateVariant[];
