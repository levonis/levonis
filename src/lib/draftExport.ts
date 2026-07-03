/**
 * Export financial drafts as PDF, Excel (CSV), or Word (HTML-based .doc)
 */
// Heavy libs (jspdf ~350KB, html2canvas ~200KB) are dynamic-imported inside
// exportDraftToPDF so the admin drafts page opens fast.


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

// ─── Shared HTML table builder (used by Word + PDF) ───
function buildHTMLTable(draft: DraftExportData): string {
  const showSub = hasSubtotalCols(draft.columns);

  const headerCells = [
    `<th style="background:#2563eb;color:#fff;padding:10px 14px;border:1px solid #1d4ed8;font-size:13px;white-space:nowrap">#</th>`,
    ...draft.columns.map(c =>
      `<th style="background:#2563eb;color:#fff;padding:10px 14px;border:1px solid #1d4ed8;font-size:13px;white-space:nowrap">${c.name}</th>`
    ),
    ...(showSub ? [`<th style="background:#ea580c;color:#fff;padding:10px 14px;border:1px solid #c2410c;font-size:13px;white-space:nowrap">المجموع</th>`] : [])
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

  const totalCells = [`<td style="background:#f1f5f9;padding:10px 14px;border:1px solid #cbd5e1;font-weight:bold;font-size:13px">المجموع الكلي</td>`];
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

  return `
    <h1 style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:22px;color:#1e293b;margin-bottom:4px;direction:rtl">${draft.title}</h1>
    <div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11px;color:#94a3b8;margin-bottom:20px;direction:rtl">تاريخ التصدير: ${new Date().toLocaleDateString('ar-IQ')} &nbsp;|&nbsp; ${draft.rows.length} صف &nbsp;|&nbsp; ${draft.columns.length} عمود</div>
    <table style="border-collapse:collapse;width:100%;direction:rtl;font-family:'Segoe UI',Tahoma,Arial,sans-serif">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr>${totalCells.join('')}</tr></tfoot>
    </table>`;
}

// ─── Word (.doc via HTML) ───
export function exportDraftToWord(draft: DraftExportData) {
  const tableHtml = buildHTMLTable(draft);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1e293b; }
</style></head>
<body>${tableHtml}</body></html>`;

  downloadBlob(html, `${draft.title}.doc`, 'application/msword;charset=utf-8');
}

// ─── PDF (html2canvas for Arabic support) ───
export async function exportDraftToPDF(draft: DraftExportData) {
  const tableHtml = buildHTMLTable(draft);

  // Create offscreen container
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;padding:24px;background:#fff;z-index:-1;direction:rtl;font-family:"Segoe UI",Tahoma,Arial,sans-serif';
  container.innerHTML = tableHtml;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgW = canvas.width;
    const imgH = canvas.height;

    // A4 landscape dimensions in mm
    const pdf = new jsPDF({
      orientation: imgW > imgH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const ratio = imgW / imgH;
    let printW = usableW;
    let printH = printW / ratio;

    // If content is taller than one page, scale to fit width and paginate
    if (printH <= usableH) {
      pdf.addImage(imgData, 'PNG', margin, margin, printW, printH);
    } else {
      // Multi-page: slice the canvas
      const scaleFactor = usableW / imgW;
      const sliceH = Math.floor(usableH / scaleFactor);
      let srcY = 0;
      let pageIdx = 0;

      while (srcY < imgH) {
        if (pageIdx > 0) pdf.addPage();
        const currentSliceH = Math.min(sliceH, imgH - srcY);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgW;
        sliceCanvas.height = currentSliceH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, imgW, currentSliceH, 0, 0, imgW, currentSliceH);

        const sliceImg = sliceCanvas.toDataURL('image/png');
        const slicePrintH = currentSliceH * scaleFactor;
        pdf.addImage(sliceImg, 'PNG', margin, margin, usableW, slicePrintH);

        srcY += currentSliceH;
        pageIdx++;
      }
    }

    pdf.save(`${draft.title}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
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
