// Subjects, strands (the report's categories) and the skills inside them.
// Math strands follow IXL's diagnostic strands; reading strands follow what DIBELS measures,
// plus vocabulary, comprehension and spelling. lo/hi = the grade range a strand covers.
import { MATH_SKILLS } from './gen/math.js';
import { READING_SKILLS } from './gen/reading.js';

export const SUBJECTS = {
  math: { id: 'math', name: 'Math', icon: '🔢', strands: ['count', 'oa', 'nbt', 'nf', 'md', 'geo'] },
  reading: { id: 'reading', name: 'Reading', icon: '📖', strands: ['letters', 'pa', 'phonics', 'sight', 'vocab', 'comp', 'spell'] },
};

export const STRANDS = {
  count: { subject: 'math', name: 'Counting & number sense', lo: -1.2, hi: 1.0, about: 'Counting objects, reading numbers, more and fewer, counting order.' },
  oa: { subject: 'math', name: 'Operations & algebraic thinking', lo: -0.6, hi: 5.0, about: 'Addition and subtraction facts, word problems, equal groups, multiplication and division facts, patterns.', ixl: 'oa' },
  nbt: { subject: 'math', name: 'Number & operations in base ten', lo: 0.7, hi: 5.0, about: 'Place value, comparing numbers, adding and subtracting big numbers, rounding, multi-digit multiplication.', ixl: 'nbt' },
  nf: { subject: 'math', name: 'Fractions', lo: 1.0, hi: 5.0, about: 'Equal parts, naming fractions, number lines, equivalent and comparing fractions, decimals.', ixl: 'nf' },
  md: { subject: 'math', name: 'Measurement & data', lo: -0.9, hi: 4.5, about: 'Comparing sizes, measuring, telling time, money, graphs, area and perimeter, units.', ixl: 'md' },
  geo: { subject: 'math', name: 'Geometry', lo: -1.3, hi: 4.7, about: 'Naming shapes, sides and corners, polygons, quadrilaterals, symmetry, angles.', ixl: 'geo' },
  letters: { subject: 'reading', name: 'Letters & letter sounds', lo: -1.2, hi: 0.9, about: 'Naming capital and small letters, and the sound each letter makes.', dibels: 'lnf' },
  pa: { subject: 'reading', name: 'Phonemic awareness', lo: -0.9, hi: 2.0, about: 'Hearing the sounds inside spoken words: rhymes, syllables, first/middle/last sounds, counting sounds.', dibels: 'psf' },
  phonics: { subject: 'reading', name: 'Phonics & decoding', lo: 0.3, hi: 4.3, about: 'Sounding out written words, from short-vowel words to long vowels, endings and multi-syllable words.', dibels: 'nwf' },
  sight: { subject: 'reading', name: 'Sight words', lo: 0.0, hi: 4.2, about: 'Recognizing common words quickly, including ones that are not spelled the way they sound.', dibels: 'wrf' },
  vocab: { subject: 'reading', name: 'Vocabulary', lo: -1.0, hi: 4.5, about: 'Word meanings: pictures, categories, opposites, synonyms, context clues, prefixes and suffixes.', dibels: 'vocab' },
  comp: { subject: 'reading', name: 'Comprehension', lo: -1.0, hi: 4.8, about: 'Understanding stories and articles: listening, sentence reading, picking words that make sense, and questions about passages.', dibels: 'maze' },
  spell: { subject: 'reading', name: 'Spelling', lo: 0.4, hi: 4.5, about: 'Building words from their sounds and choosing correct spellings.', dibels: 'spell' },
};

export const SKILLS = [...MATH_SKILLS, ...READING_SKILLS];
export const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const skillsOf = (strandId) => SKILLS.filter((s) => s.strand === strandId);
for (const [id, st] of Object.entries(STRANDS)) st.id = id;

// The school measures a parent can enter, and which strand each one informs.
export const DIBELS_MEASURES = [
  { id: 'lnf', name: 'Letter Naming (LNF)', strand: 'letters' },
  { id: 'psf', name: 'Phoneme Segmentation (PSF)', strand: 'pa' },
  { id: 'nwf', name: 'Nonsense Word Fluency (NWF)', strand: 'phonics' },
  { id: 'wrf', name: 'Word Reading (WRF)', strand: 'sight' },
  { id: 'orf', name: 'Oral Reading Fluency (ORF)', strand: null },
  { id: 'maze', name: 'Maze (comprehension)', strand: 'comp' },
  { id: 'vocab', name: 'Vocabulary', strand: 'vocab' },
  { id: 'spell', name: 'Spelling', strand: 'spell' },
];
export const IXL_STRANDS = [
  { id: 'overall', name: 'Overall math level' },
  { id: 'nbt', name: 'Number & operations in base ten' },
  { id: 'nf', name: 'Fractions' },
  { id: 'oa', name: 'Operations & algebraic thinking' },
  { id: 'md', name: 'Measurement & data' },
  { id: 'geo', name: 'Geometry' },
];
