export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ur', label: 'Urdu (اردو)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'tr', label: 'Turkish (Türkçe)' },
  { code: 'ru', label: 'Russian (Русский)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'id', label: 'Indonesian' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'fa', label: 'Persian (فارسی)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
];

export const langLabel = (code?: string | null) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code ?? '';
