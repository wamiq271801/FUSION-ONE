/**
 * HTML template path registry — server-only, zero React dependencies.
 *
 * Extracted from registry.ts so that the PNG renderer can resolve template
 * paths without pulling in @react-pdf/renderer and all PDF components.
 */
import path from 'path';
import type { TemplateVariant } from './types';

const HTML_DIR = path.join(process.cwd(), 'lib', 'invoice', 'templates', 'html');

const htmlRegistry: Record<TemplateVariant, string> = {
  prestige:  path.join(HTML_DIR, 'Prestige.html'),
  classic:   path.join(HTML_DIR, 'Classic.html'),
  minimal:   path.join(HTML_DIR, 'Minimal.html'),
  retail:    path.join(HTML_DIR, 'Retail.html'),
  executive: path.join(HTML_DIR, 'Executive.html'),
  heritage:  path.join(HTML_DIR, 'Heritage.html'),
};

export function getHtmlTemplatePath(variant: TemplateVariant): string {
  const p = htmlRegistry[variant];
  if (!p) throw new Error(`Unknown HTML template variant: ${variant}`);
  return p;
}
