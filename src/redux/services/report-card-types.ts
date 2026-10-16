/**
 * A report card as the gradebook serves it, copied from school-fe's gradebook
 * types so the two apps print the same card; keep them in step.
 */
export interface CardLine {
  label: string;
  value: string;
}

export interface CardSubject {
  name: string;
  /** Component scores as printed ("18", "ABS", "Exc"). */
  cells?: string[];
  total?: number | null;
  grade?: string | null;
  remark?: string | null;
  /** Present only where the school printed class figures and the reader may read them. */
  class_average?: string | null;
  highest?: number | null;
  lowest?: number | null;
}

/** The school year on the last term's card: each subject's total per term and the annual figures. */
export interface Cumulative {
  terms: string[];
  subjects: { name: string; totals?: string[]; annual_average?: string | null }[];
  annual_average?: string | null;
  annual_position?: string;
  promotion_line?: string;
}

/**
 * A report card, every figure from the snapshot published with the class.
 * A line or block the reader may not read is absent rather than blank.
 */
export interface ReportCard {
  letterhead: {
    school_name: string;
    logo_url: string | null;
    branch_name: string | null;
    branch_address: string | null;
    phone: string | null;
  };
  term_line: string;
  facts: CardLine[];
  components: { short_name: string; max_score: number }[];
  subjects: CardSubject[];
  totals: CardLine[];
  attendance?: CardLine[];
  ratings?: { trait: string; value: number }[];
  rating_key?: string;
  teacher_comment?: string;
  teacher_name?: string | null;
  principal_comment?: string | null;
  principal_name?: string | null;
  grading_key: string;
  cumulative?: Cumulative;
  next_term_line?: string;
  version: number;
  /** The result is withheld from the family; staff still read the card. */
  held: boolean;
}

