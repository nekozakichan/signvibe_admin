import spedLogo from '../assets/sped-logo-256.png';

// ─── Excel report export ──────────────────────────────────────────────────────
// Builds a .xlsx with the same letterhead as the on-screen report — SPED Center
// logo, "SignVibe — Student Progress Report", school + school year, and the
// generated date — above a formatted table. ExcelJS is loaded only when an
// export is clicked, so it doesn't slow down opening the Reports page.

const TEAL = 'FF00838A';
const TEAL_LIGHT = 'FFE6F4F4';
const GREY = 'FF555555';
const BORDER = { style: 'thin', color: { argb: 'FFB2DFDB' } };

/**
 * @param {object}   opts
 * @param {string}   opts.fileName   e.g. "signvibe_summary_SY2026-2027_2026-10-16.xlsx"
 * @param {string}   opts.sheetName  tab name, e.g. "Summary"
 * @param {string}   opts.reportName line under the school, e.g. "Class Summary"
 * @param {string}   opts.period     e.g. "S.Y. 2026-2027" or "All school years"
 * @param {string}  [opts.subject]   optional bold line, e.g. "Student: Bea Serafica · Grade 2"
 * @param {{header: string, width: number, align?: 'left'|'center'|'right'}[]} opts.columns
 * @param {Array<Array<string|number>>} opts.rows
 */
export async function downloadReportWorkbook({ fileName, sheetName, reportName, period, subject, columns, rows }) {
  const { default: ExcelJS } = await import('exceljs');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SignVibe';
  wb.created = new Date();

  // ── Letterhead lines ──
  const generated = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const lines = [
    { text: 'SignVibe — Student Progress Report', font: { bold: true, size: 16, color: { argb: TEAL } }, height: 26 },
    { text: `Urdaneta City SPED Center · ${period}`, font: { size: 11, color: { argb: GREY } }, height: 18 },
    ...(subject ? [{ text: subject, font: { bold: true, size: 12, color: { argb: 'FF222222' } }, height: 20 }] : []),
    { text: `${reportName} · Generated ${generated}`, font: { size: 10, italic: true, color: { argb: GREY } }, height: 16 },
  ];
  const ruleRow = lines.length + 1;      // teal line under the letterhead
  const headerRowNo = lines.length + 3;  // table column headers
  const firstDataRow = headerRowNo + 1;

  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ state: 'frozen', ySplit: headerRowNo, showGridLines: false }],
  });
  const lastCol = columns.length;
  ws.columns = columns.map((c) => ({ width: c.width }));

  lines.forEach((l, i) => {
    const r = i + 1;
    ws.mergeCells(r, 2, r, Math.max(2, lastCol));
    const cell = ws.getCell(r, 2);
    cell.value = l.text;
    cell.font = { name: 'Calibri', ...l.font };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(r).height = l.height;
  });
  ws.getRow(ruleRow).height = 8;
  for (let c = 1; c <= lastCol; c++) ws.getCell(ruleRow, c).border = { bottom: { style: 'medium', color: { argb: TEAL } } };
  ws.getRow(ruleRow + 1).height = 8;

  // Logo in column A, rows 1–3.
  try {
    const buffer = await fetch(spedLogo).then((r) => r.arrayBuffer());
    const imageId = wb.addImage({ buffer, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 0.15, row: 0.1 }, ext: { width: 72, height: 72 }, editAs: 'oneCell' });
  } catch {
    // No logo is better than no report.
  }

  // ── Table ──
  const headerRow = ws.getRow(headerRowNo);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    cell.alignment = { vertical: 'middle', horizontal: c.align || 'left', wrapText: true };
    cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
  });
  headerRow.height = 32; // room for two-line headers like "Lessons Completed"

  rows.forEach((values, idx) => {
    const row = ws.getRow(firstDataRow + idx);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v === undefined ? null : v;
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: columns[i].align || 'left' };
      cell.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_LIGHT } };
    });
    row.height = 18;
  });

  if (rows.length === 0) {
    ws.mergeCells(firstDataRow, 1, firstDataRow, lastCol);
    const cell = ws.getCell(firstDataRow, 1);
    cell.value = 'No records for this period.';
    cell.font = { italic: true, color: { argb: GREY } };
    cell.alignment = { horizontal: 'center' };
  } else {
    ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo + rows.length, column: lastCol } };
  }

  // Repeat the table header on every printed page.
  ws.pageSetup.printTitlesRow = `${headerRowNo}:${headerRowNo}`;
  ws.headerFooter.oddFooter = '&L&8SignVibe · Urdaneta City SPED Center&R&8Page &P of &N';

  const blob = new Blob([await wb.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
