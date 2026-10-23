// After a failed validation, move focus to the first invalid field in visual order. A keyboard or screen reader user is
// otherwise left at the submit button with no idea which field to fix. Ids are the input ids set by FormField.
export function focusFirstInvalid(fieldOrder: readonly string[], errors: Readonly<Record<string, unknown>>): void {
  const first = fieldOrder.find((id) => errors[id]);
  if (first) document.getElementById(first)?.focus();
}
