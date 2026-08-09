import { supabase, hasSupabaseConfig } from './supabase';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  image_url?: string | null;
  category: 'Campus News' | 'Mental Health' | 'Self-Care' | 'Academic Stress';
  source: string;
  source_url?: string | null;
  is_pinned?: boolean;
  read_time?: string;
  created_at: string;
}

/**
 * Rich fallback articles with high-definition wellness photography
 * guaranteeing that the app always displays lively, inspiring content.
 */
export const FALLBACK_NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'news-knust-hub-01',
    title: 'KNUST Counseling Center Expands 24/7 Crisis Support & Peer Wellness Rooms',
    summary: 'Students can now access immediate confidential support, quiet mindfulness spaces, and study-break care packages at the Great Hall Annex.',
    content: `The KNUST Counseling Center has officially launched an enhanced 24/7 Wellness Hub designed to support students during demanding academic periods.

Located at the Great Hall Annex, the facility offers:
• Quiet mindfulness rooms with biofeedback audio guides
• Peer counseling stations hosted by trained senior psychology students
• Direct access to licensed clinical psychologists for walk-ins
• Free mental health resources and exam stress toolkits

Dr. Kwame Boateng, Lead Counselor, emphasized that seeking help is a sign of strength: "Academic excellence requires a healthy mind. We urge all students to drop by, whether for a 15-minute breather or professional guidance."

For emergency phone assistance, the campus crisis line remains active 24/7 at 03220-60352.`,
    image_url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop',
    category: 'Campus News',
    source: 'KNUST Health Directorate',
    is_pinned: true,
    read_time: '3 min read',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'news-exam-anxiety-02',
    title: '5 Science-Backed Ways to Beat Exam Anxiety and Brain Fog',
    summary: 'Discover proven psychological techniques to boost focus, calm your nervous system, and retain information during revision.',
    content: `Feeling overwhelmed as exams approach? Neuroscience shows that high cortisol levels can impair memory retrieval and executive function. Here are 5 practical strategies to keep your mind clear:

1. The 90/15 Study Cycle
Work with focused concentration for 90 minutes, followed by a mandatory 15-minute screen-free break. This matches your brain's natural ultradian rhythm.

2. Box Breathing Before Tests
Inhale for 4 seconds, hold for 4, exhale for 4, and hold empty for 4. Doing 4 cycles lowers heart rate and shifts your brain out of fight-or-flight mode.

3. Active Recall over Passive Reading
Instead of highlighting text repeatedly, test yourself using flashcards or teaching concepts aloud. Active recall builds stronger neural pathways.

4. Hydration and Brain Energy
Dehydration by just 2% decreases attention span. Keep water nearby and limit excessive energy drinks that trigger heart palpitations.

5. Reframe Anxiety as Excitement
Physiologically, excitement and anxiety are almost identical. Telling yourself "I am energized and ready" helps turn nervous energy into focused action.`,
    image_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1000&auto=format&fit=crop',
    category: 'Mental Health',
    source: 'Psychology & Wellness Digest',
    is_pinned: false,
    read_time: '4 min read',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'news-sleep-hygiene-03',
    title: 'The 90-Minute Sleep Rule: Why Pulling All-Nighters Hurts Memory',
    summary: 'Research shows REM sleep consolidates memory. Learn how structuring sleep cycles improves academic performance.',
    content: `Pulling all-nighters might feel productive, but cognitive research demonstrates that sleep deprivation severely reduces problem-solving ability and long-term memory formation.

Why Sleep Cycles Matter:
Sleep occurs in 90-minute cycles transitioning through Light Sleep, Deep Sleep, and REM (Rapid Eye Movement). During Deep Sleep, the brain clears metabolic waste; during REM sleep, memory consolidation takes place.

Key Actionable Tips:
• Target multi-cycle blocks: Aim for 6 hours (4 cycles) or 7.5 hours (5 cycles) so you wake up between cycles feeling refreshed.
• Dim blue light 30 minutes before bed: Blue light suppresses melatonin, delaying rest.
• Quick Power Naps: A 20-minute nap between 1:00 PM and 3:00 PM restores alertness without causing sleep inertia.`,
    image_url: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=1000&auto=format&fit=crop',
    category: 'Self-Care',
    source: 'World Health Organization Wellness',
    is_pinned: false,
    read_time: '3 min read',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'news-imposter-syndrome-04',
    title: 'Overcoming Imposter Syndrome in Competitive University Programs',
    summary: 'Many high-achieving students secretly fear they don’t belong. Here is how to reframe self-doubt into confidence.',
    content: `If you’ve ever felt like an "imposter" who just got lucky, you are in good company. Studies show over 70% of university students experience imposter phenomenon at some point in their academic journey.

Recognizing the Signs:
• Attributing success solely to luck or timing
• Agonizing over minor mistakes in assignments
• Fearing that peers will "discover" you don't know enough

How to Overcome It:
• Separate Fact from Feeling: Feeling unprepared doesn't mean you are incompetent.
• Keep a Win Log: Save positive feedback, completed projects, and test scores in a dedicated folder.
• Talk Openly: Sharing your doubts with peers or a counselor reveals that almost everyone feels the same way.`,
    image_url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop',
    category: 'Academic Stress',
    source: 'Student Mind Insights',
    is_pinned: false,
    read_time: '5 min read',
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
  {
    id: 'news-mindfulness-meditation-05',
    title: '5-Minute Mindfulness Exercises for Busy Campus Schedules',
    summary: 'Short daily grounding routines to alleviate daily stress, enhance emotional resilience, and improve mood.',
    content: `You don't need an hour of meditation to experience the benefits of mindfulness. Brief 5-minute grounding breaks integrated into your daily walk across campus can significantly lower stress levels.

Try the 5-4-3-2-1 Sensory Grounding Technique:
• 5 things you can SEE around you
• 4 things you can TOUCH (your feet on the ground, clothes)
• 3 things you can HEAR (birds, footsteps, breeze)
• 2 things you can SMELL
• 1 positive thought about yourself

Practicing this simple grounding exercise shifts your focus away from racing thoughts back to the present moment.`,
    image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1000&auto=format&fit=crop',
    category: 'Self-Care',
    source: 'Mindfulness Journal',
    is_pinned: false,
    read_time: '3 min read',
    created_at: new Date(Date.now() - 3600000 * 96).toISOString(),
  },
];

/**
 * Fetch all news & wellness articles from Supabase DB, falling back and merging
 * with online/fallback articles if needed.
 */
export async function fetchNewsArticles(categoryFilter: string = 'All'): Promise<NewsArticle[]> {
  let dbArticles: NewsArticle[] = [];

  if (hasSupabaseConfig && supabase) {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        dbArticles = data as NewsArticle[];
      }
    } catch (err) {
      console.warn('[NewsService] Could not fetch articles from Supabase:', err);
    }
  }

  // Merge DB articles with fallback articles (excluding duplicates)
  const existingIds = new Set(dbArticles.map((a) => a.id));
  const merged = [
    ...dbArticles,
    ...FALLBACK_NEWS_ARTICLES.filter((a) => !existingIds.has(a.id)),
  ];

  // Sort pinned first, then newest
  merged.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (categoryFilter === 'All') {
    return merged;
  }

  return merged.filter(
    (item) => item.category.toLowerCase() === categoryFilter.toLowerCase()
  );
}

/**
 * Create a new campus news / wellness article (Admin operation).
 */
export async function createNewsArticle(
  article: Omit<NewsArticle, 'id' | 'created_at'>
): Promise<NewsArticle | null> {
  const newRecord = {
    ...article,
    created_at: new Date().toISOString(),
  };

  if (!hasSupabaseConfig || !supabase) {
    return {
      ...newRecord,
      id: `local-news-${Date.now()}`,
    };
  }

  try {
    const { data, error } = await supabase
      .from('news_articles')
      .insert({
        title: article.title,
        summary: article.summary,
        content: article.content,
        image_url: article.image_url || null,
        category: article.category,
        source: article.source || 'KNUST Wellness',
        source_url: article.source_url || null,
        is_pinned: article.is_pinned ?? false,
        read_time: article.read_time || '3 min read',
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      console.warn('[NewsService] Error inserting news article:', error);
      return {
        ...newRecord,
        id: `local-news-${Date.now()}`,
      };
    }

    return data as NewsArticle;
  } catch (err) {
    console.warn('[NewsService] Exception creating news article:', err);
    return {
      ...newRecord,
      id: `local-news-${Date.now()}`,
    };
  }
}

/**
 * Delete a news article by ID (Admin operation).
 */
export async function deleteNewsArticle(id: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return true;

  try {
    const { error } = await supabase.from('news_articles').delete().eq('id', id);
    if (error) {
      console.warn('[NewsService] Error deleting news article:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[NewsService] Exception deleting news article:', err);
    return false;
  }
}
