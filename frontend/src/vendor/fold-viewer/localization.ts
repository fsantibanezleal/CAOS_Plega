import type { LocalizedText } from './types';

function localeChain(
  requested: string | undefined,
  fallback: string,
): string[] {
  const output: string[] = [];
  const add = (locale: string) => {
    let candidate = locale;
    while (candidate) {
      if (!output.includes(candidate)) output.push(candidate);
      const separator = candidate.lastIndexOf('-');
      candidate = separator < 0 ? '' : candidate.slice(0, separator);
    }
  };
  if (requested) add(requested);
  add(fallback);
  return output;
}

export function localize(
  value: LocalizedText | undefined,
  requested: string | undefined,
  fallback: string,
): string {
  if (!value) return '';
  for (const locale of localeChain(requested, fallback))
    if (value[locale] !== undefined) return value[locale];
  return value[Object.keys(value)[0]] ?? '';
}
