/**
 * UI label copy: capitalize the first letter of each word. Words that are entirely
 * uppercase letters or digits (2+ chars), e.g. OBS or URL, are left unchanged.
 */
export function labelTitleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
