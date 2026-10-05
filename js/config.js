// Every tunable in one place (SPEC.md, "Technical requirements"): item counts, gap timings, and
// mastery thresholds. The parent's settings can override items, enabled, tempo, and placeholders.
export const CONFIG = {
  storageKey: 'phonics.progress.v1',

  // One session: six activities in a fixed order. Halftime falls after the first three.
  activities: ['soundMatch', 'blendIt', 'findSound', 'buildIt', 'readFind', 'readAloud'],
  firstHalf: ['soundMatch', 'blendIt', 'findSound'],
  items: { soundMatch: 6, blendIt: 5, findSound: 5, buildIt: 4, readFind: 6, readAloud: 6 },
  nonsenseShare: { readFind: 2 / 6, readAloud: 2 / 6 }, // four real, two nonsense
  currentStepShare: 0.6, // of the words read, the share from his current step; the rest review earlier steps

  // Seconds of silence between clips.
  gaps: { blend: 0.7, coach: 0.12, slow: 0.7, fast: 0.3 },

  // Item choice: share of items from learning records, mastered records due for review, and new ones.
  mix: { learning: 0.7, review: 0.2, new: 0.1 },
  newLettersPerSession: 2,

  mastery: {
    small: { window: 6, hits: 5 }, // letter sounds, blending, segmenting
    real: { window: 20, hits: 16 }, // decoding, real words
    nonsense: { window: 10, hits: 8 }, // decoding, nonsense words
    minDays: 3,
    keep: 20,
    reviewDays: [2, 4, 8, 16],
    relapse: { misses: 2, of: 4 },
  },

  placementAlwaysLearning: ['a', 'm', 's', 't', 'p', 'n'],
  priorityLetters: ['c', 'g', 'h', 'w', 'y', 'a', 'e', 'i', 'o', 'u'],
  lookAlikes: [['b', 'd', 'p']],
  soundAlikes: [['m', 'n']],

  returnAfter: 3, // correction step 4: a missed item comes back at least this many items later
  recycleSessions: 2, // ...and in each of the next two sessions
  winnable: { missesInRow: 2, halftimeAccuracy: 0.6 },

  goalPasses: 3,
  celebrationSeconds: 2,
  tempo: 70,
  promptCueAfterSessions: 3,
  parentHintSessions: 3,
  levelCheck: { real: 5, nonsense: 5, pass: 8 },
  // The check-ups: four one-minute parts, every two weeks once he has played a couple of matches.
  checkup: { everyDays: 14, afterMatches: 2, seconds: 60, nonsenseAtLeast: 10 },
  pieceValues: { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9 },
  wordBookMilestones: [10, 25, 50, 100],

  // Until a clip is recorded, play a placeholder tone (with a caption) instead of leaving items out.
  placeholders: true,
};

export function defaultSettings() {
  return {
    childName: '',
    items: { ...CONFIG.items },
    enabled: Object.fromEntries(CONFIG.activities.map(a => [a, true])),
    tempo: CONFIG.tempo,
    placeholders: CONFIG.placeholders,
  };
}
