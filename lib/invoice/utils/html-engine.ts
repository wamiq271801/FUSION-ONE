/**
 * HTML invoice template engine — server-only.
 *
 * Processes the custom mini-template language used by HTML invoice templates:
 *   {{data.field}}                    — variable interpolation (dot-path)
 *   <!-- IF:condition -->             — conditional block (truthy check)
 *   <!-- IF:!condition -->            — negated conditional
 *   <!-- /IF:condition -->            — end conditional
 *   <!-- LOOP:items -->               — iterate over array
 *   <!-- /LOOP:items -->              — end loop
 *   {{item.field}}                    — field inside current loop iteration
 */
import type { InvoiceData } from '../types';

const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Rs.';

function getVal(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function isTruthy(data: InvoiceData, key: string): boolean {
  if (key === 'type_purchase') return data.type === 'purchase';
  if (key === 'type_not_proforma') return data.type !== 'proforma';
  const val = getVal(data, key);
  if (Array.isArray(val)) return val.length > 0;
  return val !== undefined && val !== null && val !== '' && val !== 0 && val !== false;
}

function formatVal(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') return fmt(val);
  return String(val);
}

function buildItemDescription(item: any, type: string): string {
  if (type === 'proforma') return item.description || '';
  const parts = [item.brand, item.model].filter(Boolean);
  return parts.join(' ') || item.description || '';
}

function buildItemSubDescription(item: any, type: string): string {
  if (type === 'proforma') return '';
  const parts: string[] = [];
  if (item.imei) parts.push(`IMEI: ${item.imei}`);
  if (item.ram_rom) parts.push(item.ram_rom);
  if (item.color) parts.push(item.color);
  return parts.join(' · ');
}

function processLoops(html: string, data: InvoiceData): string {
  return html.replace(
    /<!--\s*LOOP:(\w+)\s*-->([\s\S]*?)<!--\s*\/LOOP:\1\s*-->/g,
    (_match, arrayName: string, body: string) => {
      const arr: any[] = (data as any)[arrayName] ?? [];
      return arr.map((item, idx) => {
        let row = body;
        // Process item-level IF conditionals
        row = row.replace(
          /<!--\s*IF:(!)?(item\.\w+)\s*-->([\s\S]*?)<!--\s*\/IF:\1?\2\s*-->/g,
          (_m, neg, key, content) => {
            const field = key.replace('item.', '');
            const val = item[field];
            const truthy = val !== undefined && val !== null && val !== '' && val !== 0;
            return (neg ? !truthy : truthy) ? content : '';
          },
        );
        // Replace item variables
        row = row.replace(/\{\{item\.(\w+)\}\}/g, (_m, field: string) => {
          if (field === 'index') return String(idx + 1);
          if (field === 'description') return buildItemDescription(item, data.type);
          if (field === 'sub_description') return buildItemSubDescription(item, data.type);
          const val = item[field];
          return formatVal(val);
        });
        return row;
      }).join('');
    },
  );
}

function processConditionals(html: string, data: InvoiceData): string {
  // Process in a loop until no more IF blocks are found (handles nesting)
  let result = html;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(
      /<!--\s*IF:(!?)([\w.]+)\s*-->([\s\S]*?)<!--\s*\/IF:\1?\2\s*-->/g,
      (_match, neg, key, content) => {
        const truthy = isTruthy(data, key);
        return (neg ? !truthy : truthy) ? content : '';
      },
    );
  }
  return result;
}

function processVariables(html: string, data: InvoiceData): string {
  // Build title based on type
  const title = data.type === 'purchase' ? 'Purchase Bill'
    : data.type === 'proforma' ? 'Quotation'
    : 'Tax Invoice';

  return html.replace(/\{\{data\.(\w[\w.]*)\}\}/g, (_match, path: string) => {
    if (path === 'title') return title;
    if (path === 'amount_in_words') {
      return numberToWords(Math.round(data.final_total)) + ' Rupees Only';
    }
    const val = getVal(data, path);
    return formatVal(val);
  });
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }
  return convert(num);
}

/**
 * Populate an HTML invoice template with data.
 * Returns fully rendered HTML string ready for screenshot.
 */
export function renderHtmlTemplate(templateHtml: string, data: InvoiceData): string {
  let html = templateHtml;
  html = processLoops(html, data);
  html = processConditionals(html, data);
  html = processVariables(html, data);
  return html;
}
