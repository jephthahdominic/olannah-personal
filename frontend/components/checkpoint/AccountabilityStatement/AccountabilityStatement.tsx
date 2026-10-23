import styles from './AccountabilityStatement.module.css';

export interface AccountabilityStatementProps {
  /** SUPPLIED text. It renders identically for every persona, workflow and target system (BRD 1.2 5.10 Feature 4). */
  statement: string;
  /** Optional supplied lead-in, for example "Before you decide". */
  heading?: string;
  id?: string;
}

// A plain-language statement of what approval means, in primary hierarchy above the decision controls. It is never a
// footnote, a tooltip or a secondary element, and it never varies by context.
export function AccountabilityStatement({ statement, heading, id }: AccountabilityStatementProps) {
  return (
    <section className={styles.box} aria-label={heading}>
      {heading && <p className="type-label">{heading}</p>}
      <p id={id} className="type-body">{statement}</p>
    </section>
  );
}
