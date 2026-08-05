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
  hfAnalyzeEmotion,
  hfAnalyzeSentiment,
  hfDetectToxicity,
  hfDetectCrisis,
  isHFConfigured,
  warmUpHF,
} from './hf-moderation';
import type { HFEmotionLabel } from './hf-moderation';
import { lexicalScoreToMoodKey, scoreToMoodKey } from './moods';
import type { MoodKey } from './moods';
export { isHFConfigured, warmUpHF };

// ---------------------------------------------------------------------------
// Local keyword lexicons (fallback)
// ---------------------------------------------------------------------------
const POSITIVE_WORDS = new Set([
  'happy', 'excited', 'good', 'great', 'excellent', 'glad', 'joy', 'peaceful',
  'calm', 'relax', 'productive', 'success', 'wonderful', 'amazing', 'love',
  'hope', 'grateful', 'proud', 'healing', 'well', 'optimistic', 'better',
  'safe', 'comfortable', 'confident', 'grateful', 'thankful', 'content',
  'energetic', 'motivated', 'relieved', 'supported', 'cared', 'loved',
  'accepted', 'proud', 'strong', 'brave', 'kind', 'bright', 'cheerful',
]);

const NEGATIVE_WORDS = new Set([
  'sad', 'bad', 'lonely', 'angry', 'stressed', 'anxious', 'depressed', 'failure',
  'hate', 'scared', 'fear', 'worry', 'tired', 'exhausted', 'pain', 'hurt', 'broke',
  'struggle', 'empty', 'hopeless', 'worthless', 'heavy', 'crying', 'cry', 'worst',
  'die', 'dying', 'death', 'kill', 'unsafe', 'afraid', 'terrified', 'panicking',
  'overwhelmed', 'helpless', 'trapped', 'stuck', 'lost', 'confused', 'numb',
  'broken', 'shattered', 'ruined', 'miserable', 'suffering', 'agony',
  'frustrated', 'irritated', 'resentful', 'bitter', 'jealous', 'envious',
  'disappointed', 'regret', 'guilty', 'ashamed', 'embarrassed', 'humiliated',
  'rejected', 'abandoned', 'ignored', 'neglected', 'unwanted', 'invisible',
  'annoyed', 'annoying', 'furious', 'mad', 'rage', 'livid', 'betrayed',
]);

/**
 * Anger-specific terms. Kept separate from NEGATIVE_WORDS because the valence
 * score alone cannot distinguish anger from sadness — "I feel annoyed at a
 * friend" and "I feel sad about a friend" score identically on a −1→1 axis but
 * belong to different moods. Single words are matched per-token; entries with a
 * space are matched as substrings.
 */
const ANGER_WORDS = [
  'angry', 'anger', 'annoyed', 'annoying', 'annoyance', 'irritated',
  'irritating', 'irritable', 'furious', 'fury', 'rage', 'raging', 'enraged',
  'livid', 'mad', 'pissed', 'resentful', 'resentment', 'bitter', 'hate',
  'hateful', 'disgusted', 'disgusting', 'outraged', 'outrage', 'betrayed',
  'betrayal', 'frustrated', 'frustrating', 'frustration', 'agitated',
  'offended', 'insulted', 'disrespected', 'unfair', 'infuriating',
  'fed up', 'sick of', 'had enough', 'ticked off', 'worked up', 'so done with',
  'cannot stand', "can't stand", 'gets on my nerves', 'on my nerves',
];

/**
 * Markers of despair. The emotion model saturates at sadness≈0.99 for both
 * "I feel sad and lonely today" and "I feel hopeless and empty", so it cannot
 * grade severity within sadness — and the zero-shot crisis score is identical
 * (0.034) for both. These terms are what separate 😔 Down from 😟 Distressed.
 */
const DESPAIR_WORDS = [
  'hopeless', 'worthless', 'pointless', 'no point', 'nothing matters',
  'give up', 'giving up', 'gave up', 'cant go on', "can't go on",
  'cannot go on', 'cant take it', "can't take it", 'cannot take it',
  'unbearable', 'empty inside', 'so empty', 'feel empty', 'feeling empty',
  'numb', 'nothing left', 'no future', 'no way out', 'trapped', 'drowning',
  'falling apart', 'breaking down', 'cant cope', "can't cope", 'despair',
];

const NEGATION_WORDS = new Set([
  'not', "n't", 'dont', "don't", 'doesnt', "doesn't", 'didnt', "didn't",
  'cant', "can't", 'couldnt', "couldn't", 'wouldnt', "wouldn't", 'wont', "won't",
  'never', 'neither', 'nor', 'hardly', 'barely', 'scarcely',
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
// Local keyword anger detection (fallback)
// ---------------------------------------------------------------------------
/**
 * Multi-word entries are matched against the raw lowercase text (so
 * apostrophes survive); single words are matched per-token so "madness" does
 * not count as "mad".
 */
function detectAnger(note: string): boolean {
  const lower = note.toLowerCase();
  const tokens = new Set(tokenize(note));
  return ANGER_WORDS.some((w) =>
    w.includes(' ') ? lower.includes(w) : tokens.has(w)
  );
}

function detectDespair(note: string): boolean {
  const lower = note.toLowerCase();
  const tokens = new Set(tokenize(note));
  return DESPAIR_WORDS.some((w) =>
    w.includes(' ') ? lower.includes(w) : tokens.has(w)
  );
}

// ---------------------------------------------------------------------------
// Local keyword sentiment (fallback)
// ---------------------------------------------------------------------------
function keywordSentiment(note: string): SentimentResult {
  if (!note.trim()) return { score: 0, label: 'neutral', isFlagged: false, source: 'keyword' };

  const tokens = tokenize(note);
  const lower = note.toLowerCase();

  // Negation-aware scoring: if a negation word appears before a sentiment word
  // within a 3-token window, flip its polarity.
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isPositive = POSITIVE_WORDS.has(t);
    const isNegative = NEGATIVE_WORDS.has(t);

    if (!isPositive && !isNegative) continue;

    // Check for negation in the 3 preceding tokens
    let negated = false;
    const lookback = Math.max(0, i - 3);
    for (let j = lookback; j < i; j++) {
      if (NEGATION_WORDS.has(tokens[j])) {
        negated = true;
        break;
      }
    }

    if (isPositive) {
      if (negated) neg++; else pos++;
    }
    if (isNegative) {
      if (negated) pos++; else neg++;
    }
  }

  const total = pos + neg;
  /**
   * Additive smoothing. Dividing by `total` alone saturates the scale: a note
   * with two negative words and no positive ones scored exactly −1.0, the same
   * magnitude as a long entry full of despair, so almost anything mildly
   * negative registered as maximally distressed. The constant makes the score
   * grow with the weight of evidence — one negative word ≈ −0.25, two ≈ −0.4,
   * three ≈ −0.5 — while leaving the ±0.1 positive/negative label boundaries
   * comfortably clear.
   */
  const score = total > 0 ? (pos - neg) / (total + 3) : 0;
  const isFlagged = CRISIS_WORDS.some((w) => lower.includes(w));

  let label: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (score > 0.1) label = 'positive';
  else if (score < -0.1 || isFlagged) label = 'negative';

  return { score, label, isFlagged, source: 'keyword' };
}

// ---------------------------------------------------------------------------
// Local keyword moderation (fallback)
// ---------------------------------------------------------------------------
export function keywordModerate(content: string): ModerationResult {
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

// ---------------------------------------------------------------------------
// Mood prediction — the engine behind the journal's emoji suggestion
// ---------------------------------------------------------------------------

export interface MoodAnalysis {
  mood: MoodKey;
  /** Top emotion class, when the ML model produced one. */
  emotion: HFEmotionLabel | null;
  /** Confidence in `mood`, 0–1. */
  confidence: number;
  sentiment: SentimentResult;
  isFlagged: boolean;
  source: 'huggingface' | 'keyword';
}

/**
 * Thresholds for turning a 7-way emotion distribution into one of six moods,
 * tuned against live model output rather than guessed:
 *
 *   "I feel annoyed at a friend"        anger .991            → 😠
 *   "I am fed up with this group work"  anger .30 + disgust .09 → 😠
 *   "I am terrified about my exam"      fear .99              → 😟
 *   "I feel sad and lonely today"       sadness .988          → 😔
 *   "I feel hopeless and empty"         sadness .988 + despair → 😟
 *   "I am so happy today"               joy .971              → 😁
 *   "Had a decent day, nothing special" joy .426 / neutral .468 → 😊
 *
 * Anger and disgust are summed: disgust rarely wins outright but reliably
 * co-fires with anger on irritation entries.
 */
const ANGER_MIN = 0.35;      // anger+disgust needed to select 😠
const FEAR_MIN = 0.45;       // fear needed to select 😟
const SADNESS_MIN = 0.35;    // sadness needed to select 😔
const JOY_GREAT_MIN = 0.85;  // joy needed for 😁 rather than 😊
const JOY_GOOD_MIN = 0.3;    // joy needed to select 😊

export interface MoodSignals {
  /** Crisis/self-harm detected — overrides everything. */
  isFlagged?: boolean;
  /** Despair vocabulary present; grades sadness up from 😔 to 😟. */
  hasDespairMarkers?: boolean;
}

/**
 * Pure mapping from the emotion model's output onto the mood scale.
 * Exported so the thresholds above can be reasoned about and tested directly.
 */
export function emotionToMood(
  scores: Record<HFEmotionLabel, number>,
  sentimentScore: number,
  signals: MoodSignals = {}
): { mood: MoodKey; confidence: number } {
  // Safety outranks emotion: a crisis entry is never anything but distressed.
  if (signals.isFlagged) return { mood: 'distressed', confidence: 1 };

  const anger = (scores.anger ?? 0) + (scores.disgust ?? 0);
  const fear = scores.fear ?? 0;
  const sadness = scores.sadness ?? 0;
  const joy = scores.joy ?? 0;

  // Anger first — it is the class the old valence-only pipeline could not
  // express, and it yields only when sadness or fear clearly dominates.
  if (anger >= ANGER_MIN && anger >= sadness && anger >= fear) {
    return { mood: 'angry', confidence: anger };
  }

  if (fear >= FEAR_MIN && fear >= sadness) {
    return { mood: 'distressed', confidence: fear };
  }

  if (sadness >= SADNESS_MIN) {
    return {
      mood: signals.hasDespairMarkers ? 'distressed' : 'down',
      confidence: sadness,
    };
  }

  // Positive tiers key off joy, not the valence score: the sentiment model
  // returns ~0.95 for "Today was fine" and ~0.99 for "I am so happy", so it
  // cannot separate contentment from elation. Joy can (0.35 vs 0.97).
  if (joy >= JOY_GREAT_MIN) return { mood: 'great', confidence: joy };
  if (joy >= JOY_GOOD_MIN) return { mood: 'good', confidence: joy };

  // Nothing dominant — defer to the valence axis, which still separates
  // "nothing happened today" from a quietly good or bad entry.
  return { mood: scoreToMoodKey(sentimentScore), confidence: scores.neutral ?? 0 };
}

/**
 * Offline mood prediction. Anger is checked before the valence buckets so an
 * angry entry does not land on 🙂 the way it did when the fallback had only a
 * −1→1 score to work with.
 */
export function keywordMood(note: string): MoodAnalysis {
  const sentiment = keywordSentiment(note);

  if (!note.trim()) {
    return {
      mood: 'okay',
      emotion: null,
      confidence: 0,
      sentiment,
      isFlagged: false,
      source: 'keyword',
    };
  }

  let mood: MoodKey;
  if (sentiment.isFlagged || detectDespair(note)) {
    mood = 'distressed';
  } else if (detectAnger(note)) {
    mood = 'angry';
  } else {
    mood = lexicalScoreToMoodKey(sentiment.score);
  }

  return {
    mood,
    emotion: null,
    confidence: Math.abs(sentiment.score),
    sentiment,
    isFlagged: sentiment.isFlagged,
    source: 'keyword',
  };
}

/**
 * Predicts the journal mood for `note`.
 *
 * ML-first by design: the emotion model decides the mood whenever it answers,
 * and the keyword lexicon runs only when HF is unconfigured, unreachable, or
 * returns nothing usable. The two HF calls run concurrently, and a failure in
 * either one no longer discards the other's result.
 */
export async function analyzeMood(note: string): Promise<MoodAnalysis> {
  if (!note?.trim()) return keywordMood('');

  if (isHFConfigured()) {
    try {
      const [emotionRes, sentRes, crisisRes] = await Promise.all([
        hfAnalyzeEmotion(note),
        hfAnalyzeSentiment(note),
        hfDetectCrisis(note),
      ]);

      const isFlagged = crisisRes?.isCrisis ?? false;

      let sentiment: SentimentResult;
      if (sentRes) {
        const multiplier =
          sentRes.label === 'positive' ? 1 : sentRes.label === 'negative' ? -1 : 0;
        sentiment = {
          score: parseFloat((multiplier * sentRes.score).toFixed(2)),
          label: isFlagged ? 'negative' : sentRes.label,
          isFlagged,
          source: 'huggingface',
        };
      } else {
        const local = keywordSentiment(note);
        sentiment = { ...local, isFlagged: isFlagged || local.isFlagged };
      }

      if (emotionRes) {
        const { mood, confidence } = emotionToMood(emotionRes.scores, sentiment.score, {
          isFlagged,
          hasDespairMarkers: detectDespair(note),
        });
        return {
          mood,
          emotion: emotionRes.label,
          confidence,
          sentiment,
          isFlagged,
          source: 'huggingface',
        };
      }

      // Emotion model unavailable but sentiment answered — still better than
      // the lexicon, just without an anger dimension.
      if (sentRes) {
        return {
          mood: isFlagged ? 'distressed' : scoreToMoodKey(sentiment.score),
          emotion: null,
          confidence: sentRes.score,
          sentiment,
          isFlagged,
          source: 'huggingface',
        };
      }
    } catch (err) {
      console.warn('[Mood] HF pipeline failed, using keyword fallback:', err);
    }
  }

  return keywordMood(note);
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

