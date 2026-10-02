import fs from 'fs';
import path from 'path';

/**
 * Extracts readable plain-text representation from Excel (.xlsx, .xls, .csv),
 * Word (.docx), or Text files for AI training context.
 */
export async function parseDocumentFile(filePathOrUrl: string): Promise<string> {
  try {
    let clean = filePathOrUrl.replace(/^\/+/, '');
    if (!clean.startsWith('public')) {
      clean = path.join('public', clean);
    }
    const fullPath = path.resolve(process.cwd(), clean);

    if (!fs.existsSync(fullPath)) {
      return '';
    }

    const ext = path.extname(fullPath).toLowerCase();
    const buffer = await fs.promises.readFile(fullPath);

    // 1. Excel (.xlsx, .xls) and CSV
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let output = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
          output += `\n[Sheet: ${sheetName}]\n${csv}\n`;
        }
      }
      return output.trim();
    }

    // 2. Word documents (.docx)
    if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    // 3. Text, Markdown, JSON
    if (ext === '.txt' || ext === '.json' || ext === '.md' || ext === '.csv') {
      return buffer.toString('utf-8');
    }

    return '';
  } catch (error) {
    console.error('Error parsing document file:', error);
    return '';
  }
}
