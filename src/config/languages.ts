export interface LanguageOption {
  /** Matches the :lang route parameter. */
  value: string;
  label: string;
  /** Short form for tight spots such as the header button. */
  short: string;
}

export const LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'zh-tw', label: '繁體中文', short: '繁' },
  { value: 'zh-cn', label: '简体中文', short: '简' },
];

/** The option matching a locale, falling back to the first one. */
export function languageOption(value?: string): LanguageOption {
  return LANGUAGES.find((option) => option.value === value) ?? LANGUAGES[0];
}
