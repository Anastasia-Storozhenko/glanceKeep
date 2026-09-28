export function isCyrillicText(text: string): boolean {
  return /[а-яіїєґ]/i.test(text);
}

export type UkGender = 'masculine' | 'feminine' | 'neuter';

const FEMININE_SOFT_SIGN_EXCEPTIONS = new Set([
  'сіль',
  'ніч',
  'мідь',
  'відповідь',
  'кров',
  'любов',
  'подорож',
  'тінь',
  "пам'ять",
  'осінь',
  'радість',
  'річ',
  'піч',
  'миша',
]);

export function analyzeUkrainianNoun(phrase: string): { gender: UkGender; isPlural: boolean } {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const head = (words[words.length - 1] ?? '').toLowerCase();

  if (!head) {
    return { gender: 'masculine', isPlural: false };
  }

  const isPlural = head.length > 2 && /[иі]$/.test(head);
  if (isPlural) {
    return { gender: 'masculine', isPlural: true };
  }

  if (/[ая]$/.test(head)) {
    return { gender: 'feminine', isPlural: false };
  }
  if (/[ое]$/.test(head) || head.endsWith('є')) {
    return { gender: 'neuter', isPlural: false };
  }
  if (head.endsWith('ь')) {
    return {
      gender: FEMININE_SOFT_SIGN_EXCEPTIONS.has(head) ? 'feminine' : 'masculine',
      isPlural: false,
    };
  }
  return { gender: 'masculine', isPlural: false };
}

export function getUkrainianPossessive(phrase: string): string {
  const { gender, isPlural } = analyzeUkrainianNoun(phrase);
  if (isPlural) return 'Ваші';
  if (gender === 'feminine') return 'Ваша';
  if (gender === 'neuter') return 'Ваше';
  return 'Ваш';
}

const UK_LOCATION_PREPOSITIONS = [
  'на',
  'в',
  'у',
  'під',
  'над',
  'за',
  'перед',
  'біля',
  'поруч',
  'всередині',
  'зверху',
  'знизу',
  'коло',
  'при',
  'серед',
  'між',
  'із',
  'з',
  'по',
  'край',
];

export function hasLeadingUkPreposition(location: string): boolean {
  const normalized = location.toLowerCase().trim();
  return UK_LOCATION_PREPOSITIONS.some((prep) => new RegExp(`^${prep}\\b`, 'iu').test(normalized));
}

export function withUkLocationPreposition(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return trimmed;
  return hasLeadingUkPreposition(trimmed) ? trimmed : `на ${trimmed}`;
}

export function getUkrainianRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now.getTime() - past.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInHours < 1) return 'щойно';
  if (diffInHours < 24) return `${diffInHours} год тому`;
  if (diffInDays === 1) return 'учора';
  if (diffInDays < 7) return `${diffInDays} дн. тому`;
  return past.toLocaleDateString('uk-UA');
}
