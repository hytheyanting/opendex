/** Accept actual words across languages, while rejecting punctuation/noise. */
export function hasCommandWords(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
