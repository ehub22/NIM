/** Joins conditional class names, dropping falsy entries. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
}
