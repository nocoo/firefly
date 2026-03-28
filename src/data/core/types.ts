// ---------------------------------------------------------------------------
// Core types for the data layer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

/** Field definition for dynamic UPDATE — key is camelCase (D5), column is snake_case */
export interface FieldDef {
  /** DB column name (snake_case) */
  column: string;
  /**
   * If true, null means "clear this field" (SET col = NULL).
   * If false/omitted, null still passes through to DB — let the constraint reject it.
   */
  nullable?: boolean;
}
