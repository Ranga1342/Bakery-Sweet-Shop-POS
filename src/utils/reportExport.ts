export interface ExportMetadata {
  businessName: string;
  reportTitle: string;
  reportingPeriod: string;
  branchScope: string;
  exportDate: string;
}

export interface ExportSheet {
  name: string;
  title?: string;
  headers: string[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports one or more tabular sections as a clean UTF-8 CSV file with metadata header.
 */
export function exportReportCsv(
  filename: string,
  metadata: ExportMetadata,
  sheets: ExportSheet[]
): void {
  const lines: string[] = [];

  lines.push([escapeCsvCell('Business Name'), escapeCsvCell(metadata.businessName)].join(','));
  lines.push([escapeCsvCell('Report Title'), escapeCsvCell(metadata.reportTitle)].join(','));
  lines.push([escapeCsvCell('Reporting Period'), escapeCsvCell(metadata.reportingPeriod)].join(','));
  lines.push([escapeCsvCell('Branch Scope'), escapeCsvCell(metadata.branchScope)].join(','));
  lines.push([escapeCsvCell('Export Date'), escapeCsvCell(metadata.exportDate)].join(','));
  lines.push('');

  sheets.forEach((sheet, idx) => {
    if (idx > 0) lines.push('');
    if (sheet.title || sheets.length > 1) {
      lines.push(escapeCsvCell(sheet.title || sheet.name));
    }
    lines.push(sheet.headers.map(escapeCsvCell).join(','));
    sheet.rows.forEach((row) => {
      lines.push(row.map(escapeCsvCell).join(','));
    });
    if (sheet.totalsRow) {
      lines.push(sheet.totalsRow.map(escapeCsvCell).join(','));
    }
  });

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

function escapeXml(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  // Excel worksheet names max 31 chars, cannot contain \ / ? * [ ] :
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Report';
  let candidate = cleaned;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`;
    candidate = cleaned.slice(0, 31 - suffix.length) + suffix;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Generates a standards-compliant Excel SpreadsheetML (.xls) multi-worksheet file
 * with metadata header, numeric typing, column widths, and totals rows.
 */
export function exportReportExcel(
  filename: string,
  metadata: ExportMetadata,
  sheets: ExportSheet[]
): void {
  const usedNames = new Set<string>();

  const renderCell = (val: string | number, styleId = 'Cell') => {
    const isNum = typeof val === 'number' && Number.isFinite(val);
    const type = isNum ? 'Number' : 'String';
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>`;
  };

  const worksheetsXml = sheets
    .map((sheet) => {
      const sheetName = sanitizeSheetName(sheet.name, usedNames);
      const colCount = Math.max(sheet.headers.length, 2);

      // Estimate readable column widths
      const columnsXml = Array.from({ length: colCount }, (_, colIdx) => {
        const headerLen = String(sheet.headers[colIdx] ?? '').length;
        const maxDataLen = sheet.rows.reduce(
          (max, r) => Math.max(max, String(r[colIdx] ?? '').length),
          0
        );
        const totalLen = sheet.totalsRow ? String(sheet.totalsRow[colIdx] ?? '').length : 0;
        const width = Math.min(44, Math.max(14, Math.max(headerLen, maxDataLen, totalLen) + 4));
        return `<Column ss:AutoFitWidth="0" ss:Width="${width * 6.4}"/>`;
      }).join('');

      const metaRows = [
        ['Business Name', metadata.businessName],
        ['Report Title', sheet.title || metadata.reportTitle],
        ['Reporting Period', metadata.reportingPeriod],
        ['Branch Scope', metadata.branchScope],
        ['Export Date', metadata.exportDate],
      ]
        .map(
          ([k, v]) =>
            `<Row>${renderCell(k, 'MetaLabel')}${renderCell(v, 'MetaValue')}</Row>`
        )
        .join('');

      const headerRow = `<Row ss:Height="22">${sheet.headers
        .map((h) => renderCell(h, 'Header'))
        .join('')}</Row>`;

      const dataRows = sheet.rows
        .map(
          (r) =>
            `<Row>${r.map((cell) => renderCell(cell, 'Cell')).join('')}</Row>`
        )
        .join('');

      const totalsXml = sheet.totalsRow
        ? `<Row ss:Height="20">${sheet.totalsRow
            .map((cell) => renderCell(cell, 'Total'))
            .join('')}</Row>`
        : '';

      return `<Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
    ${columnsXml}
    ${metaRows}
    <Row/>
    ${headerRow}
    ${dataRows}
    ${totalsXml}
  </Table>
</Worksheet>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#181210"/>
    </Style>
    <Style ss:ID="MetaLabel">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#64748B"/>
      <Interior ss:Color="#FAF9F5" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaValue">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#181210"/>
      <Interior ss:Color="#FAF9F5" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#181210" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Cell">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#181210"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Total">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#181210"/>
      <Interior ss:Color="#FFF7ED" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FB923C"/>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="1" ss:Color="#181210"/>
      </Borders>
    </Style>
  </Styles>
  ${worksheetsXml}
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}
