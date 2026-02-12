declare module "xlsx" {
  export interface WorkSheet {
    "!cols"?: Array<{ wch?: number }>;
    [key: string]: unknown;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export const utils: {
    json_to_sheet(data: unknown[]): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
  };

  export function writeFile(wb: WorkBook, filename: string): void;
}
