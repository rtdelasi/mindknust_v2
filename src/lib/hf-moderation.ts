/**
 * Hugging Face Inference API — ML-Powered Moderation Engine
 *
 * Models used:
 *  - Emotion:    j-hartmann/emotion-english-distilroberta-base (7-way)
 *  - Sentiment:  cardiffnlp/twitter-roberta-base-sentiment-latest
 *  - Toxicity:   unitary/toxic-bert
 *  - Crisis:     facebook/bart-large-mnli (zero-shot classification)
 *
 * Falls back to null on network failure so the caller can use
 * the local keyword engine as a safe fallback.
 */

import { configuredValue } from '@/lib/env';

const HF_API_KEY = configuredValue(process.env.EXPO_PUBLIC_HF_API_KEY) ?? '';
const HF_BASE = 'https://router.huggingface.co/hf-inference/models';

export const HF_EMOTION_MODEL = 'j-hartmann/emotion-english-distilroberta-base';
export const HF_SENTIMENT_MODEL = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
export const HF_TOXICITY_MODEL = 'unitary/toxic-bert';
export const HF_CRISIS_MODEL = 'facebook/bart-large-mnli';

/**
 * A cold model on the serverless tier takes ~7s to return its first prediction
 * and <0.5s once warm. The previous 6s ceiling aborted almost every cold start,
 * which is why the keyword fallback appeared to run "always" — the very first
 * request of a session was guaranteed to lose the race, and each retry after an
 * app restart hit a cold model again.
 */
const REQUEST_TIMEOUT_MS = 20000;

// Transient failures (cold start / rate limit / gateway) are retried; anything
// else fails fast so a bad key or bad payload surfaces immediately.
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [400, 1200];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Helper: fetch with timeout
// ---------------------------------------------------------------------------
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Helper: base POST to HF inference endpoint
//
// `x-wait-for-model` asks the router to hold the connection while a cold model
// spins up instead of answering 503, so a first-of-session request returns a
// real prediction rather than nothing.
// ---------------------------------------------------------------------------
async function hfPost(model: string, payload: object): Promise<unknown> {
  if (!HF_API_KEY) return null; // Skip entirely if no key configured

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(`${HF_BASE}/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true',
          'x-use-cache': 'true',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) return await res.json();

      const body = await res.text();
      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS - 1) {
        lastError = new Error(`HF API ${res.status}: ${body}`);
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 1200);
        continue;
      }

      throw new Error(`HF API ${res.status}: ${body}`);
    } catch (err) {
      lastError = err;
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      const isNetwork = err instanceof TypeError;
      // Timeouts and dropped connections are worth one more shot; a thrown
      // HTTP error above has already exhausted its retries.
      if ((isAbort || isNetwork) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt] ?? 1200);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error('HF API: exhausted retries');
}

/**
 * Parses the `[[{label, score}, ...]]` shape every text-classification model on
 * the router returns, tolerating the un-nested `[{...}]` variant.
 */
function parseClassification(
  raw: unknown
): { label: string; score: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = Array.isArray(raw[0]) ? raw[0] : raw;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const parsed = (rows as { label?: unknown; score?: unknown }[])
    .filter((r) => typeof r?.label === 'string' && typeof r?.score === 'number')
    .map((r) => ({ label: r.label as string, score: r.score as number }));

  return parsed.length > 0 ? parsed : null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface HFSentimentResult {
  label: 'positive' | 'neutral' | 'negative';
  score: number; // confidence 0–1
}

export interface HFToxicityResult {
  isToxic: boolean;
  score: number; // confidence 0–1
}

export interface HFCrisisResult {
  isCrisis: boolean;
  score: number; // confidence 0–1
}

/** The 7 classes emitted by j-hartmann/emotion-english-distilroberta-base. */
export type HFEmotionLabel =
  | 'anger'
  | 'disgust'
  | 'fear'
  | 'joy'
  | 'neutral'
  | 'sadness'
  | 'surprise';

export interface HFEmotionResult {
  label: HFEmotionLabel;   // highest-confidence emotion
  score: number;           // its confidence 0–1
  scores: Record<HFEmotionLabel, number>; // full distribution
}

const EMOTION_LABELS: HFEmotionLabel[] = [
  'anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise',
];

// ---------------------------------------------------------------------------
// 0. Emotion Classification
//    Model: j-hartmann/emotion-english-distilroberta-base
//    Output format: [[{label, score}, ...]] over the 7 labels above
//
//    This is what lets the journal tell anger apart from sadness. A 3-class
//    sentiment model collapses both into "negative", so "I feel annoyed at a
//    friend" and "I feel devastated" are indistinguishable to it.
// ---------------------------------------------------------------------------
export async function hfAnalyzeEmotion(
  text: string
): Promise<HFEmotionResult | null> {
  try {
    const raw = await hfPost(HF_EMOTION_MODEL, { inputs: text });
    const rows = parseClassification(raw);
    if (!rows) return null;

    const scores = EMOTION_LABELS.reduce(
      (acc, l) => ({ ...acc, [l]: 0 }),
      {} as Record<HFEmotionLabel, number>
    );

    for (const row of rows) {
      const label = row.label.toLowerCase() as HFEmotionLabel;
      if (EMOTION_LABELS.includes(label)) scores[label] = row.score;
    }

    const top = EMOTION_LABELS.reduce((best, l) =>
      scores[l] > scores[best] ? l : best
    );

    if (scores[top] <= 0) return null;

    return { label: top, score: scores[top], scores };
  } catch (err) {
    console.warn('[HF Emotion] API call failed, using keyword fallback:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Sentiment Analysis
//    Model: cardiffnlp/twitter-roberta-base-sentiment-latest
//    Output format: [[{label, score}, ...]]
//    Labels: LABEL_0 = negative, LABEL_1 = neutral, LABEL_2 = positive
// ---------------------------------------------------------------------------
export async function hfAnalyzeSentiment(
  text: string
): Promise<HFSentimentResult | null> {
  try {
    const raw = await hfPost(HF_SENTIMENT_MODEL, { inputs: text });
    const rows = parseClassification(raw);
    if (!rows) return null;

    const labelMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
      LABEL_0: 'negative',
      LABEL_1: 'neutral',
      LABEL_2: 'positive',
      negative: 'negative',
      neutral: 'neutral',
      positive: 'positive',
    };

    const labels: HFSentimentResult[] = rows
      .map((item) => ({
        label: labelMap[item.label] ?? 'neutral',
        score: item.score,
      }))
      .sort((a, b) => b.score - a.score);

    // Return the highest-confidence prediction
    return labels[0] ?? null;
  } catch (err) {
    console.warn('[HF Sentiment] API call failed, using keyword fallback:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Toxicity Detection
//    Model: unitary/toxic-bert
//    Output format: [[{label: 'toxic'|'non-toxic', score}]]
// ---------------------------------------------------------------------------
export async function hfDetectToxicity(
  text: string
): Promise<HFToxicityResult | null> {
  try {
    const raw = await hfPost(HF_TOXICITY_MODEL, { inputs: text });
    const rows = parseClassification(raw);
    if (!rows) return null;

    const toxicEntry = rows.find((r) => r.label.toLowerCase() === 'toxic');
    if (!toxicEntry) return null;

    return {
      isToxic: toxicEntry.score > 0.6, // threshold: 60% confidence
      score: toxicEntry.score,
    };
  } catch (err) {
    console.warn('[HF Toxicity] API call failed, using keyword fallback:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Crisis / Self-Harm Detection
//    Model: facebook/bart-large-mnli (zero-shot classification)
//    We classify against ["crisis or self-harm", "mental distress", "normal content"]
// ---------------------------------------------------------------------------
export async function hfDetectCrisis(
  text: string
): Promise<HFCrisisResult | null> {
  try {
    const candidateLabels = [
      'suicide or self harm',
      'expressing a desire to die or stop living',
      'mental distress',
      'normal content',
    ];
    const raw = await hfPost(HF_CRISIS_MODEL, {
      inputs: text,
      parameters: { candidate_labels: candidateLabels },
    });

    if (!raw) return null;

    let crisisScore = 0;
    if (Array.isArray(raw)) {
      // Format: list of { label, score }
      for (const item of raw) {
        if (item && (item.label === 'suicide or self harm' || item.label === 'expressing a desire to die or stop living')) {
          crisisScore += item.score || 0;
        }
      }
    } else if (typeof raw === 'object') {
      // Format: { labels: string[], scores: number[] }
      const result = raw as { labels?: string[]; scores?: number[] };
      if (Array.isArray(result.labels) && Array.isArray(result.scores)) {
        result.labels.forEach((label, idx) => {
          if (label === 'suicide or self harm' || label === 'expressing a desire to die or stop living') {
            crisisScore += result.scores?.[idx] || 0;
          }
        });
      } else {
        return null;
      }
    } else {
      return null;
    }

    return {
      isCrisis: crisisScore > 0.35, // threshold for self-harm / suicidal ideation labels
      score: Math.min(1, parseFloat(crisisScore.toFixed(2))),
    };
  } catch (err) {
    console.warn('[HF Crisis] API call failed, using keyword fallback:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Convenience: check if HF API is configured
// ---------------------------------------------------------------------------
export function isHFConfigured(): boolean {
  return !!HF_API_KEY && HF_API_KEY.startsWith('hf_');
}

// ---------------------------------------------------------------------------
// Warm-up
//
// Serverless models are evicted when idle, so the first inference of a session
// pays a multi-second load. Firing a throwaway request when the journal screen
// mounts moves that cost off the user's first keystroke — by the time they have
// typed a sentence the model is resident and answers in ~0.5s.
// ---------------------------------------------------------------------------
let warmUpStarted = false;

export function warmUpHF(): void {
  if (warmUpStarted || !isHFConfigured()) return;
  warmUpStarted = true;

  hfPost(HF_EMOTION_MODEL, { inputs: 'hello' }).catch(() => {
    // Warm-up is best-effort; a failure here just means the first real
    // request pays the cold start, exactly as before.
    warmUpStarted = false;
  });
}
