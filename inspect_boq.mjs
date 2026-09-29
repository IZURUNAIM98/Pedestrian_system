import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const files = process.argv.slice(2);
for (const file of files) {
  const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  const summary = await wb.inspect({ kind: "sheet,region,formula", maxChars: 14000, tableMaxRows: 8, tableMaxCols: 14, tableMaxCellChars: 120, options: { maxResults: 120 } });
  console.log(`FILE ${file}\n${summary.ndjson ?? summary}`);
}
