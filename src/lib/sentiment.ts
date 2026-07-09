/**
 * Sentiment Analysis & Content Moderation
 *
 * Primary:  Hugging Face Inference API (ML transformer models)
 * Fallback: Local keyword/lexicon engine (instant, works offline)
 *
 * Both paths produce the same result shape so callers are unaffected
 * regardless of which path runs.
 */

import {
  hfAnalyzeSentiment,
  hfDetectToxicity,
  hfDetectCrisis,
  isHFConfigured,
} from './hf-moderation';

// ---------------------------------------------------------------------------
// Local keyword lexicons (fallback)
// ---------------------------------------------------------------------------
const POSITIVE_WORDS = new Set([
  'happy', 'excited', 'good', 'great', 'excellent', 'glad', 'joy', 'peaceful',
  'calm', 'relax', 'productive', 'success', 'wonderful', 'amazing', 'love',
  'hope', 'grateful', 'proud', 'healing', 'well', 'optimistic', 'better',
]);

const NEGATIVE_WORDS = new Set([
  'sad', 'bad', 'lonely', 'angry', 'stressed', 'anxious', 'depressed', 'failure',
  'hate', 'scared', 'fear', 'worry', 'tired', 'exhausted', 'pain', 'hurt', 'broke',
  'struggle', 'empty', 'hopeless', 'worthless', 'heavy', 'crying', 'cry', 'worst',
  'die', 'dying', 'death', 'kill',
]);

const CRISIS_WORDS = [
  'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'cutting', 'overdose',
  'end my life', 'harming myself', 'feel like dying', 'feeling like dying', 'wishing to die',
  'wish i was dead', 'better off dead', 'rather be dead',
];

const TOXIC_WORDS = [
  'fuck', 'bitch', 'shit', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
  'slut', 'retard', 'bully', 'harass', 'idiot', 'moron',
];

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
export interface SentimentResult {
  score: number;                           // -1.0 (very negative) → 1.0 (very positive)
  label: 'positive' | 'neutral' | 'negative';
  isFlagged: boolean;                      // true = self-harm / crisis content
  source: 'huggingface' | 'keyword';      // which engine produced the result
}

export interface ModerationResult {
  status: 'approved' | 'flagged' | 'blocked';
  isFlagged: boolean;
  reason?: string;
  source: 'huggingface' | 'keyword';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

// ---------------------------------------------------------------------------
// Local keyword sentiment (fallback)
// ---------------------------------------------------------------------------
function keywordSentiment(note: string): SentimentResult {
  if (!note.trim()) return { score: 0, label: 'neutral', isFlagged: false, source: 'keyword' };

  const tokens = tokenize(note);
  const lower = note.toLowerCase();

  let pos = 0;
  let neg = 0;
  tokens.forEach((t) => {
    if (POSITIVE_WORDS.has(t)) pos++;
    if (NEGATIVE_WORDS.has(t)) neg++;
  });

  const total = pos + neg;
  const score = total > 0 ? (pos - neg) / total : 0;
  const isFlagged = CRISIS_WORDS.some((w) => lower.includes(w));

  let label: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (score > 0.1) label = 'positive';
  else if (score < -0.1 || isFlagged) label = 'negative';

  return { score, label, isFlagged, source: 'keyword' };
}

// ---------------------------------------------------------------------------
// Local keyword moderation (fallback)
// ---------------------------------------------------------------------------
function keywordModerate(content: string): ModerationResult {
  if (!content.trim()) return { status: 'approved', isFlagged: false, source: 'keyword' };

  const lower = content.toLowerCase();

  if (CRISIS_WORDS.some((w) => lower.includes(w))) {
    return { status: 'flagged', isFlagged: true, reason: 'Self-harm trigger detected', source: 'keyword' };
  }

  if (TOXIC_WORDS.some((w) => lower.includes(w))) {
    return { status: 'blocked', isFlagged: true, reason: 'Community guidelines violation: profanity/toxicity', source: 'keyword' };
  }

  return { status: 'approved', isFlagged: false, source: 'keyword' };
}

// ---------------------------------------------------------------------------
// PUBLIC API — async, HF-first with keyword fallback
// ---------------------------------------------------------------------------

/**
 * Analyze the sentiment of a mood check-in note.
 *
 * Tries Hugging Face (RoBERTa + BART zero-shot) first.
 * Falls back to keyword lexicon on network failure or missing API key.
 */
export async function analyzeSentiment(note: string): Promise<SentimentResult> {
  if (!note?.trim()) {
    return { score: 0, label: 'neutral', isFlagged: false, source: 'keyword' };
  }

  if (isHFConfigured()) {
    try {
      // Run sentiment + crisis detection in parallel for speed
      const [sentResult, crisisResult] = await Promise.all([
        hfAnalyzeSentiment(note),
        hfDetectCrisis(note),
      ]);

      if (sentResult) {
        const isFlagged = crisisResult?.isCrisis ?? false;
        // Map HF confidence score to our -1→1 scale
        const multiplier = sentResult.label === 'positive' ? 1 : sentResult.label === 'negative' ? -1 : 0;
        const score = parseFloat((multiplier * sentResult.score).toFixed(2));

        return {
          score,
          label: isFlagged ? 'negative' : sentResult.label,
          isFlagged,
          source: 'huggingface',
        };
      }
    } catch {
      // Silently fall through to keyword engine
    }
  }

  return keywordSentiment(note);
}

/**
 * Moderate a social feed post for toxicity and crisis content.
 *
 * Tries Hugging Face (toxic-bert + BART zero-shot) first.
 * Falls back to keyword lexicon on network failure or missing API key.
 */
export async function moderateContent(content: string): Promise<ModerationResult> {
  if (!content?.trim()) {
    return { status: 'approved', isFlagged: false, source: 'keyword' };
  }

  if (isHFConfigured()) {
    try {
      // Run both detectors in parallel
      const [toxicResult, crisisResult] = await Promise.all([
        hfDetectToxicity(content),
        hfDetectCrisis(content),
      ]);

      // Crisis takes priority over toxicity
      if (crisisResult?.isCrisis) {
        return {
          status: 'flagged',
          isFlagged: true,
          reason: `Self-harm/crisis content detected (confidence: ${(crisisResult.score * 100).toFixed(0)}%)`,
          source: 'huggingface',
        };
      }

      if (toxicResult?.isToxic) {
        return {
          status: 'blocked',
          isFlagged: true,
          reason: `Toxic content detected by ML model (confidence: ${(toxicResult.score * 100).toFixed(0)}%)`,
          source: 'huggingface',
        };
      }

      // Both models returned results but neither flagged — approved
      if (toxicResult !== null || crisisResult !== null) {
        return { status: 'approved', isFlagged: false, source: 'huggingface' };
      }
    } catch {
      // Silently fall through to keyword engine
    }
  }

  return keywordModerate(content);
}

export interface MentalStateAnalysis {
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
  };
  detectedPatterns: {
    anxiety: boolean;
    burnout: boolean;
    depression: boolean;
    crisis: boolean;
  };
  primaryState: 'normal' | 'anxiety' | 'burnout' | 'depression' | 'crisis';
}

/**
 * Analyzes a journal entry in real-time.
 * Checks for anxiety, academic burn-out, severe depression, and crisis patterns.
 */
export function analyzeJournalMentalState(note: string): MentalStateAnalysis {
  const lower = note.toLowerCase().trim();
  if (!lower) {
    return {
      sentiment: { score: 0, label: 'neutral' },
      detectedPatterns: { anxiety: false, burnout: false, depression: false, crisis: false },
      primaryState: 'normal',
    };
  }

  // Anxiety patterns: fear, panic, shaking, overwhelmed, chest tight, hyperventilating
  const anxietyKeywords = [
    'anxious', 'anxiety', 'panic', 'worry', 'worried', 'scared', 'fear', 'nervous', 'tense', 
    'dread', 'shaking', 'heart racing', 'heart beating fast', 'cannot breathe', "can't breathe", 
    'chest tight', 'overwhelmed', 'uneasy', 'jittery', 'stress', 'stressed', 'paralyzed'
  ];
  const isAnxiety = anxietyKeywords.some(w => lower.includes(w));

  // Burn-out patterns: fatigue, workload, dropping out, failing, assignments, exam stress
  const burnoutKeywords = [
    'burnout', 'burnt out', 'exhausted', 'study', 'studying', 'exam', 'exams', 'test', 'tests', 
    'assignment', 'assignments', 'grade', 'grades', 'gpa', 'midsem', 'midsems', 'lecture', 
    'lectures', 'workload', 'academic', 'knust', 'class', 'classes', 'fail', 'failing', 
    'academic pressure', 'syllabus', 'courses', 'course', 'drop out', 'dropping out'
  ];
  const isBurnout = burnoutKeywords.some(w => lower.includes(w));

  // Depression patterns: hopelessness, worthlessness, heavy crying, emptiness, giving up
  const depressionKeywords = [
    'depress', 'depression', 'empty', 'emptiness', 'hopeless', 'hopelessness', 'worthless', 
    'worthlessness', 'pointless', 'no point', 'give up', 'giving up', 'lonely', 'loneliness', 
    'dark', 'darkness', 'miserable', 'numb', 'lost', 'sadness', 'crying', 'cry', 'sad'
  ];
  const isDepression = depressionKeywords.some(w => lower.includes(w));

  // Crisis patterns: self-harm, suicide, wanting to die
  const crisisKeywords = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'wishing to die', 
    'self-harm', 'self harm', 'harm myself', 'cutting', 'overdose', 'end it all', 'harming myself',
    'feel like dying', 'feeling like dying', 'wish i was dead', 'better off dead', 'rather be dead'
  ];
  const isCrisis = crisisKeywords.some(w => lower.includes(w));

  // Sentiment calculation using local engine
  const sent = keywordSentiment(note);

  // Determine primary state. Crisis overrides everything.
  let primaryState: 'normal' | 'anxiety' | 'burnout' | 'depression' | 'crisis' = 'normal';
  if (isCrisis) {
    primaryState = 'crisis';
  } else if (isDepression) {
    primaryState = 'depression';
  } else if (isAnxiety) {
    primaryState = 'anxiety';
  } else if (isBurnout) {
    primaryState = 'burnout';
  }

  return {
    sentiment: {
      score: sent.score,
      label: sent.label,
    },
    detectedPatterns: {
      anxiety: isAnxiety,
      burnout: isBurnout,
      depression: isDepression,
      crisis: isCrisis,
    },
    primaryState,
  };
}

