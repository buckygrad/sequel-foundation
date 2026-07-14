// xlsx-brand: the brand-navy header standard and the layout helpers produce a
// valid workbook with the expected styling.

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  HEADER_FILL,
  HEADER_FONT,
  addHeader,
  titleBlock,
  workbookToBuffer,
} from "../docs-kit/xlsx-brand";

describe("xlsx-brand", () => {
  it("header fill is brand navy (deck/docx parity), not zinc", () => {
    expect(HEADER_FILL.fgColor?.argb).toBe("FF0F1263");
    expect(HEADER_FONT.bold).toBe(true);
  });

  it("addHeader + titleBlock style rows and the workbook serializes", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Test");
    titleBlock(sheet, "Title", "Subtitle", 3);
    addHeader(sheet, ["A", "B", "C"]);
    sheet.addRow(["1", "2", "3"]);

    const headerRow = sheet.getRow(4); // title, subtitle, spacer, header
    expect(headerRow.getCell(1).value).toBe("A");
    expect(headerRow.fill).toMatchObject({ fgColor: { argb: "FF0F1263" } });

    const buf = await workbookToBuffer(wb);
    // xlsx is a zip: PK signature.
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
