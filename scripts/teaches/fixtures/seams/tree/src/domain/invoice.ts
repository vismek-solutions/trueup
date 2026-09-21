export interface Invoice {
  readonly invoiceTotal: number;
}

export const emptyInvoice: Invoice = { invoiceTotal: 0 };
