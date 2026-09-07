export const TRANSLATION_PROVIDER = 'TRANSLATION_PROVIDER';

export interface TranslationProvider {
  translateToEnglish(text: string): Promise<string>;
}
