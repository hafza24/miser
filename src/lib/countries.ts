export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia',
  'Austria', 'Bahrain', 'Bangladesh', 'Belgium', 'Brazil',
  'Canada', 'Chile', 'China', 'Colombia', 'Czech Republic',
  'Denmark', 'Egypt', 'Ethiopia', 'Finland', 'France',
  'Germany', 'Ghana', 'Greece', 'Hungary', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kuwait', 'Lebanon', 'Libya', 'Malaysia', 'Mexico',
  'Morocco', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria',
  'Norway', 'Oman', 'Pakistan', 'Palestine', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
  'Russia', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea',
  'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Thailand', 'Tunisia', 'Turkey',
  'UAE', 'Uganda', 'Ukraine', 'United Kingdom', 'United States',
  'Venezuela', 'Vietnam', 'Yemen', 'Zimbabwe',
] as const;

export const AVAILABILITY_OPTIONS = [
  'Morning (6AM–12PM)',
  'Afternoon (12PM–5PM)',
  'Evening (5PM–9PM)',
  'Night (9PM–12AM)',
  'Late Night (12AM–6AM)',
  'Anytime',
] as const;

export type Country = typeof COUNTRIES[number];
export type Availability = typeof AVAILABILITY_OPTIONS[number];
