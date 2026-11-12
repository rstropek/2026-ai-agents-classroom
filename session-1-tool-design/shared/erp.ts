// A tiny stand-in for an ERP system. A real one would have thousands of functions.
// Both examples use exactly these functions, only the way the model reaches them differs.

type Args = Record<string, any>;

type ErpFunction = {
  name: string;
  description: string;
  keywords: string[];
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  run: (args: Args) => unknown;
};

const customers: Record<string, { id: string; name: string }> = {
  "C-1": { id: "C-1", name: "Alpenblick Hotel GmbH" },
  "C-2": { id: "C-2", name: "Donau Logistik AG" },
  "C-3": { id: "C-3", name: "Tischlerei Huber" },
};

const invoices = [
  { id: "R-11", customer_id: "C-1", amount: 1200, status: "overdue" },
  { id: "R-12", customer_id: "C-2", amount: 3100, status: "overdue" },
  { id: "R-13", customer_id: "C-3", amount: 450, status: "paid" },
  { id: "R-14", customer_id: "C-3", amount: 2300, status: "overdue" },
  { id: "R-15", customer_id: "C-1", amount: 2900, status: "overdue" },
  { id: "R-16", customer_id: "C-2", amount: 700, status: "open" },
  { id: "R-17", customer_id: "C-3", amount: 1900, status: "overdue" },
  { id: "R-18", customer_id: "C-1", amount: 800, status: "overdue" },
  { id: "R-19", customer_id: "C-2", amount: 250, status: "overdue" },
];

const CREDIT_NOTE_LIMIT = 200;
const MAX_PAGE_SIZE = 5;

export const functions: ErpFunction[] = [
  {
    name: "invoice.list",
    description: "List invoices, optionally by status. Returns one page at a time.",
    keywords: ["invoice", "bill", "overdue", "receivable"],
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "open, paid, or overdue" },
        limit: { type: "number", description: "Page size, default 3, at most 5" },
        cursor: { type: "string", description: "Value of next_cursor from the previous page" },
      },
      required: [],
    },
    run: ({ status, limit = 3, cursor = "0" }) => {
      const matches = invoices.filter((invoice) => !status || invoice.status === status);
      const start = Number(cursor);
      const end = start + Math.max(1, Math.min(Number(limit), MAX_PAGE_SIZE));
      return {
        // Paging: a small default, and the result says what is still missing.
        items: matches.slice(start, end).map((invoice) => ({
          ...invoice,
          // Link: the concrete call that gets the related record.
          links: { customer: { function: "customer.get", args: { id: invoice.customer_id } } },
        })),
        page: { total: matches.length, next_cursor: end < matches.length ? String(end) : null },
      };
    },
  },
  {
    name: "customer.get",
    description: "Get one customer by id.",
    keywords: ["customer", "client", "account"],
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Customer id, for example C-1" } },
      required: ["id"],
    },
    run: ({ id }) => customers[id] ?? { error: `No customer with id ${id}.` },
  },
  {
    name: "credit_note.create",
    description: "Create a credit note for an invoice.",
    keywords: ["credit", "credit note", "refund", "gutschrift"],
    parameters: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Invoice id, for example R-11" },
        amount: { type: "number", description: "Amount in EUR" },
      },
      required: ["invoice_id", "amount"],
    },
    run: ({ invoice_id, amount }) => {
      if (!invoices.some((invoice) => invoice.id === invoice_id)) {
        return { error: `No invoice with id ${invoice_id}.` };
      }
      if (typeof amount !== "number" || amount <= 0) {
        return { error: "amount must be a positive number." };
      }
      // Breakpoint 9.3: the amount the model asked for, right before the limit check.
      if (amount > CREDIT_NOTE_LIMIT) {
        // Error message: why it failed and the call that gets the user further.
        return {
          error: `Credit notes above ${CREDIT_NOTE_LIMIT} EUR need an approval.`,
          next_step: { function: "credit_note.request_approval", args: { invoice_id, amount } },
        };
      }
      return { credit_note_id: "G-1", invoice_id, amount, status: "created" };
    },
  },
  {
    name: "credit_note.request_approval",
    description: "Ask a manager to approve a credit note above the limit.",
    keywords: ["credit", "credit note", "approval", "freigabe"],
    parameters: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Invoice id" },
        amount: { type: "number", description: "Amount in EUR" },
      },
      required: ["invoice_id", "amount"],
    },
    run: ({ invoice_id, amount }) => ({ approval_id: "A-1", invoice_id, amount, status: "pending" }),
  },
];

export function searchFunctions(query: string) {
  const words = query.toLowerCase().split(/\s+/);
  return functions
    .filter(({ name, description, keywords }) => {
      const text = `${name} ${description} ${keywords.join(" ")}`.toLowerCase();
      return words.some((word) => text.includes(word));
    })
    .map(({ name, description }) => ({ name, description }));
}

export function describeFunction(name: string) {
  const fn = functions.find((candidate) => candidate.name === name);
  if (!fn) {
    return { error: `Unknown function ${name}.`, next_step: "Search for the right name first." };
  }
  return { name: fn.name, description: fn.description, parameters: fn.parameters };
}

export function callFunction(name: string, args: Args) {
  const fn = functions.find((candidate) => candidate.name === name);
  if (!fn) {
    return { error: `Unknown function ${name}.`, next_step: "Search for the right name first." };
  }
  // A generic call has no provider-side schema, so the ERP checks the arguments itself.
  const missing = fn.parameters.required.filter((key) => args[key] === undefined);
  const unknown = Object.keys(args).filter((key) => !(key in fn.parameters.properties));
  // Breakpoint 9.2: args exactly as the model wrote them.
  if (missing.length > 0 || unknown.length > 0) {
    return {
      error: `Missing arguments: ${missing.join(", ") || "none"}. Unknown arguments: ${unknown.join(", ") || "none"}.`,
      parameters: fn.parameters,
    };
  }
  return fn.run(args);
}
