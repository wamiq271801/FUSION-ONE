/**
 * Central invoice template registry.
 * Maps template variant keys to PDF components.
 */
import type { InvoiceData, TemplateVariant } from './types';

import PrestigeTemplate  from './templates/Prestige';
import ClassicTemplate   from './templates/Classic';
import MinimalTemplate   from './templates/Minimal';
import RetailTemplate    from './templates/Retail';
import ExecutiveTemplate from './templates/Executive';
import HeritageTemplate  from './templates/Heritage';

type PdfTemplateComponent = React.ComponentType<{ data: InvoiceData }>;

const pdfRegistry: Record<TemplateVariant, PdfTemplateComponent> = {
  prestige:  PrestigeTemplate,
  classic:   ClassicTemplate,
  minimal:   MinimalTemplate,
  retail:    RetailTemplate,
  executive: ExecutiveTemplate,
  heritage:  HeritageTemplate,
};

export function getPdfTemplate(variant: TemplateVariant): PdfTemplateComponent {
  const T = pdfRegistry[variant];
  if (!T) throw new Error(`Unknown template variant: ${variant}`);
  return T;
}

export const availableTemplates: TemplateVariant[] = Object.keys(pdfRegistry) as TemplateVariant[];
