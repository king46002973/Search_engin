// client/src/api/export.d.ts
declare interface ExportOptions {
  data: any[] | object;
  format: 'CSV' | 'JSON' | 'XLSX';
  filename: string;
  mapping?: {
    [field: string]: string;
  };
  includeHeader?: boolean;
}

declare interface ExportProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

declare class ExportError extends Error {
  code: string;
  details?: any;
}