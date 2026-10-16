// ─── FSL lesson days ──────────────────────────────────────────────────────────
// The 9-day outline of the Division Training on Basic Filipino Sign Language
// (SDO Urdaneta City / LINK Center for the Deaf, Oct–Dec 2022). Each lesson
// can be tagged with the day it belongs to; the tag is stored on the lesson
// document as `day` (a number 1–9), so the Android app can group by it too.

export const FSL_DAYS = [
  { day: 1, topics: 'Alphabet, Fingerspelling, W-questions, Be verbs, Pronouns' },
  { day: 2, topics: 'Greetings' },
  { day: 3, topics: 'Time, Quantity, Sizes & Shapes' },
  { day: 4, topics: 'Colors, People' },
  { day: 5, topics: 'Adjectives' },
  { day: 6, topics: 'Verbs' },
  { day: 7, topics: 'Places, Parts of the House, Things at Home' },
  { day: 8, topics: 'Food' },
  { day: 9, topics: 'Parts of the Body, Clothing & Accessories' },
];

/** The day a lesson is tagged with, or null if it has none (or a bad value). */
export function lessonDay(lesson) {
  const day = Number(lesson?.day);
  return FSL_DAYS.some((d) => d.day === day) ? day : null;
}

export function dayTopics(day) {
  return FSL_DAYS.find((d) => d.day === Number(day))?.topics || '';
}
