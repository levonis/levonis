/**
 * Export financial drafts as PDF, Excel (CSV), or Word (HTML-based .doc)
 */
import jsPDF from 'jspdf';

type ColType = 'text' | 'date' | 'number' | 'quantity';

interface DraftColumn { id: string; name: string; type?: ColType; }
interface DraftRow { id: string; [key: string]: string; }

interface DraftExportData {
  title: string;
  columns: DraftColumn[];
  rows: DraftRow[];
  updatedAt: string;
}

function calcRowSubtotal(row: DraftRow, columns: DraftColumn[]): number {
  const qtyCols = columns.filter(c => c.type === 'quantity');
  const numCols = columns.filter(c => c.type === 'number');
  if (qtyCols.length === 0 || numCols.length === 0) return 0;
  let total = 0;
  for (const qCol of qtyCols) {
    const qty = parseFloat(row[qCol.id] || '0') || 0;
    for (const nCol of numCols) {
      const price = parseFloat(row[nCol.id] || '0') || 0;
      total += qty * price;
    }
  }
  return total;
}

function fmt(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US');
}

const hasSubtotalCols = (cols: DraftColumn[]) =>
  cols.some(c => c.type === 'quantity') && cols.some(c => c.type === 'number');

// ─── CSV / Excel ───
export function exportDraftToExcel(draft: DraftExportData) {
  const showSub = hasSubtotalCols(draft.columns);
  const headers = ['#', ...draft.columns.map(c => c.name), ...(showSub ? ['المجموع'] : [])];

  const escapeCSV = (v: string) => {
    if (v.includes(',') || v.includes('\n') || v.includes('"')) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const rows = draft.rows.map((row, i) => {
    const cells = [String(i + 1)];
    draft.columns.forEach(col => {
      const val = row[col.id] || '';
      cells.push((col.type === 'number' || col.type === 'quantity') ? fmt(val) : val);
    });
    if (showSub) cells.push(fmt(calcRowSubtotal(row, draft.columns)));
    return cells.map(escapeCSV).join(',');
  });

  // Grand totals
  const totalsRow = ['المجموع الكلي'];
  draft.columns.forEach(col => {
    if (col.type === 'number' || col.type === 'quantity') {
      const total = draft.rows.reduce((s, r) => s + (parseFloat(r[col.id] || '0') || 0), 0);
      totalsRow.push(fmt(total));
    } else {
      totalsRow.push('');
    }
  });
  if (showSub) {
    const grandSub = draft.rows.reduce((s, r) => s + calcRowSubtotal(r, draft.columns), 0);
    totalsRow.push(fmt(grandSub));
  }

  const csv = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows, totalsRow.map(escapeCSV).join(',')].join('\r\n');
  downloadBlob(csv, `${draft.title}.csv`, 'text/csv;charset=utf-8');
}

// ─── Word (.doc via HTML) ───
export function exportDraftToWord(draft: DraftExportData) {
  const showSub = hasSubtotalCols(draft.columns);
  const colCount = draft.columns.length + 1 + (showSub ? 1 : 0);

  const headerCells = [`<th style="background:#2563eb;color:#fff;padding:10px 14px;border:1px solid #1d4ed8;font-size:13px">#</th>`,
    ...draft.columns.map(c =>
      `<th style="background:#2563eb;color:#fff;padding:10px 14px;border:1px solid #1d4ed8;font-size:13px">${c.name}</th>`
    ),
    ...(showSub ? [`<th style="background:#ea580c;color:#fff;padding:10px 14px;border:1px solid #c2410c;font-size:13px">المجموع</th>`] : [])
  ].join('');

  const bodyRows = draft.rows.map((row, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const cells = [`<td style="background:${bg};padding:8px 14px;border:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px">${i + 1}</td>`];
    draft.columns.forEach(col => {
      const val = row[col.id] || '';
      const isNum = col.type === 'number' || col.type === 'quantity';
      const color = col.type === 'number' ? '#059669' : col.type === 'quantity' ? '#7c3aed' : '#1e293b';
      cells.push(`<td style="background:${bg};padding:8px 14px;border:1px solid #e2e8f0;font-size:12px;color:${color};${isNum ? 'direction:ltr;text-align:right;font-family:monospace' : ''}">${isNum ? fmt(val) : val || '—'}</td>`);
    });
    if (showSub) {
      const sub = calcRowSubtotal(row, draft.columns);
      cells.push(`<td style="background:${bg};padding:8px 14px;border:1px solid #e2e8f0;font-size:12px;color:#ea580c;direction:ltr;text-align:right;font-family:monospace;font-weight:bold">${fmt(sub)}</td>`);
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  // Totals row
  const totalCells = [`<td style="background:#f1f5f9;padding:10px 14px;border:1px solid #cbd5e1;font-weight:bold;font-size:13px" colspan="1">المجموع الكلي</td>`];
  draft.columns.forEach(col => {
    if (col.type === 'number' || col.type === 'quantity') {
      const total = draft.rows.reduce((s, r) => s + (parseFloat(r[col.id] || '0') || 0), 0);
      const color = col.type === 'number' ? '#059669' : '#7c3aed';
      totalCells.push(`<td style="background:#f1f5f9;padding:10px 14px;border:1px solid #cbd5e1;font-weight:bold;font-size:13px;color:${color};direction:ltr;text-align:right;font-family:monospace">${fmt(total)}</td>`);
    } else {
      totalCells.push(`<td style="background:#f1f5f9;padding:10px 14px;border:1px solid #cbd5e1"></td>`);
    }
  });
  if (showSub) {
    const grandSub = draft.rows.reduce((s, r) => s + calcRowSubtotal(r, draft.columns), 0);
    totalCells.push(`<td style="background:#fff7ed;padding:10px 14px;border:1px solid #cbd5e1;font-weight:bold;font-size:14px;color:#ea580c;direction:ltr;text-align:right;font-family:monospace">${fmt(grandSub)}</td>`);
  }

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1e293b; }
  h1 { font-size: 22px; color: #1e293b; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #94a3b8; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; }
</style></head>
<body>
  <h1>${draft.title}</h1>
  <div class="meta">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} &nbsp;|&nbsp; ${draft.rows.length} صف &nbsp;|&nbsp; ${draft.columns.length} عمود</div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>${totalCells.join('')}</tr></tfoot>
  </table>
</body></html>`;

  downloadBlob(html, `${draft.title}.doc`, 'application/msword;charset=utf-8');
}

// ─── PDF ───
export function exportDraftToPDF(draft: DraftExportData) {
  const showSub = hasSubtotalCols(draft.columns);
  const allCols = [...draft.columns.map(c => c.name), ...(showSub ? ['المجموع'] : [])];
  const colCount = allCols.length + 1; // +1 for #

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Load Arabic-compatible font isn't easy with jsPDF, so we'll use the built-in approach
  // and render a clean table with numbers (which are universal)
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableW = pageW - margin * 2;
  const rowH = 8;
  const headerH = 10;

  // Calculate column widths proportionally
  const numColW = 28;
  const idxColW = 12;
  const fixedW = idxColW + draft.columns.filter(c => c.type === 'number' || c.type === 'quantity' || c.type === 'date').length * numColW + (showSub ? numColW : 0);
  const textCols = draft.columns.filter(c => c.type !== 'number' && c.type !== 'quantity' && c.type !== 'date');
  const textColW = textCols.length > 0 ? (usableW - fixedW) / textCols.length : 0;

  const colWidths: number[] = [idxColW];
  draft.columns.forEach(col => {
    if (col.type === 'number' || col.type === 'quantity' || col.type === 'date') {
      colWidths.push(numColW);
    } else {
      colWidths.push(Math.max(textColW, 20));
    }
  });
  if (showSub) colWidths.push(numColW);

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(draft.title, pageW / 2, margin + 4, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`${draft.rows.length} rows | ${draft.columns.length} columns | ${new Date().toLocaleDateString('en-US')}`, pageW / 2, margin + 10, { align: 'center' });
  doc.setTextColor(0);

  let y = margin + 16;

  // Draw header
  const drawHeader = () => {
    let x = margin;
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y, usableW, headerH, 'F');
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    // # column
    doc.text('#', x + idxColW / 2, y + headerH / 2 + 1, { align: 'center' });
    x += idxColW;

    draft.columns.forEach((col, i) => {
      const w = colWidths[i + 1];
      doc.text(col.name.substring(0, 15), x + w / 2, y + headerH / 2 + 1, { align: 'center' });
      x += w;
    });

    if (showSub) {
      doc.setFillColor(234, 88, 12);
      doc.rect(x, y, numColW, headerH, 'F');
      doc.setTextColor(255);
      doc.text('Total', x + numColW / 2, y + headerH / 2 + 1, { align: 'center' });
    }

    doc.setTextColor(0);
    y += headerH;
  };

  drawHeader();

  // Draw rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  draft.rows.forEach((row, idx) => {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }

    const bg = idx % 2 === 0;
    if (bg) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usableW, rowH, 'F');
    }

    // Draw border
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowH, margin + usableW, y + rowH);

    let x = margin;
    // #
    doc.setTextColor(150);
    doc.text(String(idx + 1), x + idxColW / 2, y + rowH / 2 + 1, { align: 'center' });
    x += idxColW;

    draft.columns.forEach((col, i) => {
      const w = colWidths[i + 1];
      const val = row[col.id] || '';
      const isNum = col.type === 'number' || col.type === 'quantity';

      if (col.type === 'number') doc.setTextColor(5, 150, 105);
      else if (col.type === 'quantity') doc.setTextColor(124, 58, 237);
      else doc.setTextColor(30, 41, 59);

      const display = isNum ? fmt(val) : (val || '-');
      const align = isNum ? 'right' : 'left';
      const textX = align === 'right' ? x + w - 3 : x + 3;
      doc.text(display.substring(0, 20), textX, y + rowH / 2 + 1, { align });
      x += w;
    });

    if (showSub) {
      const sub = calcRowSubtotal(row, draft.columns);
      doc.setTextColor(234, 88, 12);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(sub), x + numColW - 3, y + rowH / 2 + 1, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    y += rowH;
  });

  // Grand totals
  if (draft.rows.length > 0) {
    if (y + rowH + 2 > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, usableW, rowH + 2, 'F');
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + usableW, y);
    doc.setLineWidth(0.2);

    let x = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('TOTAL', x + idxColW / 2, y + (rowH + 2) / 2 + 1, { align: 'center' });
    x += idxColW;

    draft.columns.forEach((col, i) => {
      const w = colWidths[i + 1];
      if (col.type === 'number' || col.type === 'quantity') {
        const total = draft.rows.reduce((s, r) => s + (parseFloat(r[col.id] || '0') || 0), 0);
        if (col.type === 'number') doc.setTextColor(5, 150, 105);
        else doc.setTextColor(124, 58, 237);
        doc.text(fmt(total), x + w - 3, y + (rowH + 2) / 2 + 1, { align: 'right' });
      }
      x += w;
    });

    if (showSub) {
      const grandSub = draft.rows.reduce((s, r) => s + calcRowSubtotal(r, draft.columns), 0);
      doc.setTextColor(234, 88, 12);
      doc.text(fmt(grandSub), x + numColW - 3, y + (rowH + 2) / 2 + 1, { align: 'right' });
    }
  }

  doc.save(`${draft.title}.pdf`);
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
