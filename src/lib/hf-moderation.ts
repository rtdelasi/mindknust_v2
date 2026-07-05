/**
 * Hugging Face Inference API — ML-Powered Moderation Engine
 *
 * Models used:
 *  - Sentiment:  cardiffnlp/twitter-roberta-base-sentiment-latest
 *  - Toxicity:   unitary/toxic-bert
 *  - Crisis:     facebook/bart-large-mnli (zero-shot classification)
 *
 * Falls back to null on network failure so the caller can use
 * the local keyword engine as a safe fallback.
 */

const HF_API_KEY = process.env.EXPO_PUBLIC_HF_API_KEY ?? '';
const HF_BASE = 'https://api-inference.huggingface.co/models';

// Timeout for each HF request (ms) — keeps UX snappy even on slow connections
const REQUEST_TIMEOUT_MS = 6000;

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
// ---------------------------------------------------------------------------
async function hfPost(model: string, payload: object): Promise<unknown> {
  if (!HF_API_KEY) return null; // Skip entirely if no key configured

  const res = await fetchWithTimeout(
    `${HF_BASE}/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    // 503 = model is loading (cold start) — treat as transient, return null
    if (res.status === 503) return null;
    throw new Error(`HF API ${res.status}: ${await res.text()}`);
  }

  return res.json();
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
    const raw = await hfPost(
      'cardiffnlp/twitter-roberta-base-sentiment-latest',
      { inputs: text }
    );

    if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null;

    const labels: HFSentimentResult[] = (raw[0] as { label: string; score: number }[])
      .map((item) => {
        const labelMap: Record<string, 'positive' | 'neutral' | 'negative'> = {
          LABEL_0: 'negative',
          LABEL_1: 'neutral',
          LABEL_2: 'positive',
        };
        return {
          label: labelMap[item.label] ?? 'neutral',
          score: item.score,
        };
      })
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
    const raw = await hfPost('unitary/toxic-bert', { inputs: text });

    if (!Array.isArray(raw) || !Array.isArray(raw[0])) return null;

    const results = raw[0] as { label: string; score: number }[];
    const toxicEntry = results.find(
      (r) => r.label.toLowerCase() === 'toxic'
    );

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
    const raw = await hfPost('facebook/bart-large-mnli', {
      inputs: text,
      parameters: {
        candidate_labels: ['crisis or self-harm', 'mental distress', 'normal content'],
      },
    });

    if (!raw || typeof raw !== 'object') return null;

    const result = raw as {
      labels: string[];
      scores: number[];
    };

    const crisisIdx = result.labels.indexOf('crisis or self-harm');
    if (crisisIdx === -1) return null;

    const crisisScore = result.scores[crisisIdx];
    return {
      isCrisis: crisisScore > 0.55, // threshold: 55% confidence
      score: crisisScore,
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
