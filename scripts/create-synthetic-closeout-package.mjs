import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const productRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(productRoot, "fixtures", "synthetic-electrical-closeout-package");
const syntheticNotice = "SYNTHETIC TEST DOCUMENT — no customer, contractor, or project data.";
const fixedDate = new Date("2026-08-01T12:00:00.000Z");

async function ensure(relativeDirectory) {
  const target = join(fixtureRoot, relativeDirectory);
  await mkdir(target, { recursive: true });
  return target;
}

async function writeTextPdf(path, title, lines) {
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setCreationDate(fixedDate);
  document.setModificationDate(fixedDate);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([612, 792]);
  page.drawText(title, { x: 54, y: 720, size: 18, font: bold, color: rgb(0.04, 0.22, 0.42) });
  page.drawText(syntheticNotice, { x: 54, y: 690, size: 9, font, color: rgb(0.75, 0.25, 0.05) });
  lines.forEach((line, index) => page.drawText(line, { x: 54, y: 650 - index * 28, size: 11, font, color: rgb(0.1, 0.13, 0.18) }));
  await writeFile(path, await document.save({ useObjectStreams: false }));
}

async function writeScanOnlyPdf(path) {
  const document = await PDFDocument.create();
  document.setTitle("Synthetic image-only warranty scan");
  document.setCreationDate(fixedDate);
  document.setModificationDate(fixedDate);
  const page = document.addPage([612, 792]);
  page.drawRectangle({ x: 45, y: 45, width: 522, height: 702, borderWidth: 2, borderColor: rgb(0.35, 0.35, 0.35) });
  for (let index = 0; index < 12; index += 1) {
    page.drawRectangle({ x: 78, y: 650 - index * 42, width: 420 - (index % 3) * 55, height: 8, color: rgb(0.72, 0.72, 0.72) });
  }
  await writeFile(path, await document.save({ useObjectStreams: false }));
}

async function writeDocx(path, title, lines) {
  const document = new Document({ sections: [{ children: [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: syntheticNotice }),
    ...lines.map((line) => new Paragraph({ text: line }))
  ] }] });
  await writeFile(path, await Packer.toBuffer(document));
}

const drawings = await ensure("01_Record_Drawings");
await writeTextPdf(join(drawings, "Electrical_One-Line_As-Built.pdf"), "Electrical One-Line As-Built Record Drawing", [
  "Issue date: 2026-08-01.",
  "One-line as-built record drawing for the synthetic distribution system.",
  "For classifier validation only; not for construction or code compliance."
]);

const schedules = await ensure("02_Panel_Schedules");
const workbook = new ExcelJS.Workbook();
workbook.created = fixedDate;
workbook.modified = fixedDate;
const sheet = workbook.addWorksheet("Panel Schedules");
sheet.addRows([
  [syntheticNotice],
  ["Electrical panel schedules for panel and circuit closeout records"],
  ["Revision date", "2026-08-01"],
  ["Panel", "Circuit", "Description"],
  ["LP-1", "1", "Synthetic lighting branch"],
  ["PP-1", "3", "Synthetic receptacle branch"]
]);
await workbook.xlsx.writeFile(join(schedules, "Electrical_Panel_Schedules.xlsx"));

const testing = await ensure("03_Testing");
await writeTextPdf(join(testing, "Electrical_Acceptance_Testing_Report.pdf"), "Electrical Acceptance Testing Report", [
  "Test date: August 1, 2026.",
  "Electrical acceptance testing report for synthetic switchgear and power equipment.",
  "No compliance conclusion is represented."
]);

const manuals = await ensure("04_Operations_Maintenance");
await writeDocx(join(manuals, "Electrical_Equipment_OM_Manual.docx"), "Electrical Equipment O&M Manual", [
  "Operations and maintenance information for synthetic electrical equipment.",
  "Includes fictional startup, shutdown, inspection, and maintenance notes."
]);

const warranties = await ensure("05_Warranties");
await writeScanOnlyPdf(join(warranties, "Electrical_Equipment_Warranty_Scan.pdf"));

const spares = await ensure("06_Spare_Parts");
await writeFile(join(spares, "Electrical_Material_Turnover.csv"), [
  syntheticNotice,
  "spare parts and attic stock material turnover",
  "item,quantity,location",
  "synthetic breaker,2,owner storage",
  "synthetic lamp,12,owner storage"
].join("\n"));

const training = await ensure("07_Training");
await writeDocx(join(training, "Owner_Training_Completion_Record.docx"), "Owner Training Completion Record", [
  "Completion date: 2026-08-01.",
  "Owner training attendance and completion record for synthetic electrical equipment.",
  "Attendees: Synthetic Owner Representative; Synthetic Electrical Trainer."
]);

console.log(`Created synthetic closeout package at ${fixtureRoot}`);
