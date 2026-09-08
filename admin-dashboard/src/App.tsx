import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Users,
  LogOut,
  TrendingUp,
  MessageSquare,
  Clock,
  Heart,
  Search,
  Trash2,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Calendar,
  Megaphone,
  Flag,
  Ban,
  TriangleAlert,
  ShieldCheck,
  Eye,
  Send,
  Newspaper,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts';
import { supabase, hasSupabaseConfig } from './supabase';
import { THEME } from './theme';

// Type definitions
interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  created_at?: string;
}

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  image_url?: string | null;
  category: 'Campus News' | 'Mental Health' | 'Self-Care' | 'Academic Stress';
  source: string;
  is_pinned?: boolean;
  read_time?: string;
  created_at: string;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles?: {
    name: string;
    role: string;
  };
  moderation_status?: 'approved' | 'flagged' | 'blocked';
  is_flagged?: boolean;
  flag_reason?: string;
}

interface FlaggedContent {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles?: { name: string; role: string };
  moderation_status: 'flagged' | 'blocked';
  is_flagged: boolean;
  flag_reason?: string;
}

interface MoodLog {
  id: string;
  student_id: string;
  mood: string;
  note: string;
  created_at: string;
}

interface Appointment {
  id: string;
  student_id: string;
  counselor_id: string;
  appointment_date: string;
  status: string;
  notes?: string;
  student_profile?: { name: string };
  counselor_profile?: { name: string };
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

/**
 * Apple HIG Unified Glassmorphic Recharts Tooltip
 */
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#192030]/95 backdrop-blur-md border border-white/10 px-3.5 py-2.5 rounded-xl shadow-2xl text-xs">
        <p className="text-slate-400 font-medium mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-slate-100 font-semibold flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color || entry.fill || THEME.colors.brand.DEFAULT }}
              />
              <span className="text-slate-400 font-normal">{entry.name}:</span>
              <strong className="text-white font-bold">{entry.value}</strong>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@mindknust.edu.gh');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'flagged' | 'counselors' | 'notifications' | 'news'>('overview');

  // Database States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [flaggedContent, setFlaggedContent] = useState<FlaggedContent[]>([]);
  const [counselorApps, setCounselorApps] = useState<any[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // News Publishing Form State
  const [newsTitle, setNewsTitle] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsImageUrl, setNewsImageUrl] = useState('');
  const [newsCategory, setNewsCategory] = useState<'Campus News' | 'Mental Health' | 'Self-Care' | 'Academic Stress'>('Campus News');
  const [newsSource, setNewsSource] = useState('KNUST Wellness');
  const [newsIsPinned, setNewsIsPinned] = useState(false);
  const [newsSubmitting, setNewsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Flagged Content sub-filter
  const [flaggedSubTab, setFlaggedSubTab] = useState<'flagged' | 'blocked' | 'escalations'>('flagged');

  // Broadcast Notification Form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Search & Filter States
  const [modSearch, setModSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'flagged'>('all');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (adminEmail && password && hasSupabaseConfig) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: adminEmail.trim(),
          password: password.trim(),
        });

        if (!error && data?.user) {
          setIsLoggedIn(true);
          return;
        }
      } catch (e) {
        console.warn('Supabase admin login notice:', e);
      }
    }

    if (password === 'admin123' || password === 'mindknust2026') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Administrator Credentials or Passcode.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError('');

    // Without Supabase credentials every query fails after a slow DNS timeout,
    // which previously left the dashboard spinning for ~49s and then showed
    // empty tables with no explanation. Fail fast with an actionable message.
    if (!hasSupabaseConfig) {
      setLoadError(
        'Supabase is not configured. Create admin-dashboard/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example), then restart the dev server.'
      );
      setLoading(false);
      return;
    }

    try {
      // Run every query concurrently — these are independent, and issuing them
      // sequentially multiplied any per-request latency by seven.
      const [
        profRes,
        postRes,
        moodRes,
        apptRes,
        notifRes,
        flagRes,
        cAppRes,
        newsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase
          .from('posts')
          .select('*, profiles:user_id(name, role)')
          .order('created_at', { ascending: false }),
        supabase.from('mood_logs').select('*').order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select(`
          *,
          student_profile:student_id(name),
          counselor_profile:counselor_id(name)
        `)
          .order('appointment_date', { ascending: false }),
        supabase.from('notifications').select('*').is('user_id', null).order('created_at', { ascending: false }),
        supabase
          .from('posts')
          .select('*, profiles:user_id(name, role)')
          .in('moderation_status', ['flagged', 'blocked'])
          .order('created_at', { ascending: false }),
        supabase
          .from('counselor_profiles')
          .select(`
          *,
          profile:profiles!user_id(name, email, avatar_url)
        `)
          .order('created_at', { ascending: false }),
        supabase.from('news_articles').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      ]);

      setProfiles(profRes.data || []);
      setPosts(postRes.data || []);
      setMoodLogs(moodRes.data || []);
      setAppointments(apptRes.data || []);
      setAnnouncements(notifRes.data || []);
      setFlaggedContent((flagRes.data || []) as FlaggedContent[]);
      setCounselorApps(cAppRes.data || []);
      setNewsArticles(newsRes.data || []);

      // supabase-js resolves with an `error` field rather than throwing, so a
      // try/catch alone would report success on a total connection failure.
      const failures = [
        ['profiles', profRes.error],
        ['posts', postRes.error],
        ['mood_logs', moodRes.error],
        ['appointments', apptRes.error],
        ['notifications', notifRes.error],
        ['flagged posts', flagRes.error],
        ['counselor_profiles', cAppRes.error],
      ].filter(([, err]) => err) as [string, { message: string }][];

      if (failures.length > 0) {
        console.error('Error fetching database tables:', failures);
        setLoadError(
          `Failed to load ${failures.map(([t]) => t).join(', ')}: ${failures[0][1].message}`
        );
      }
    } catch (err) {
      console.error('Error fetching database tables:', err);
      setLoadError(err instanceof Error ? err.message : 'Unknown error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  // Moderation: Flagged keywords filter
  const FLAGGED_KEYWORDS = ['sad', 'depressed', 'fail', 'lonely', 'stressed', 'anxious', 'kill', 'hate', 'cry'];
  
  const isPostFlagged = (content: string) => {
    return FLAGGED_KEYWORDS.some(word => content.toLowerCase().includes(word));
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(modSearch.toLowerCase()) ||
      (post.profiles?.name || '').toLowerCase().includes(modSearch.toLowerCase());
    
    if (selectedFilter === 'flagged') {
      return matchesSearch && isPostFlagged(post.content);
    }
    return matchesSearch;
  });

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Flagged Content Actions
  const handleApproveFlaggedPost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ moderation_status: 'approved', is_flagged: false, flag_reason: null })
        .eq('id', postId);
      if (error) throw error;
      setFlaggedContent(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      alert('Approval failed: ' + err.message);
    }
  };

  const handleDeleteFlaggedPost = async (postId: string) => {
    if (!window.confirm('Permanently delete this post?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      setFlaggedContent(prev => prev.filter(p => p.id !== postId));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File type validation (whitelist image types only)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Security Error: Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.');
      return;
    }

    // File size validation (limit to 5MB)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert('Security Error: File size exceeds the maximum limit of 5MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      // Sanitize file extension to prevent path traversal
      if (!/^[a-zA-Z0-9]+$/.test(fileExt)) {
        throw new Error('Invalid file extension.');
      }
      const fileName = `news_${Date.now()}.${fileExt}`;
      const filePath = `news-articles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('social-media')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('social-media').getPublicUrl(filePath);
      if (data?.publicUrl) {
        setNewsImageUrl(data.publicUrl);
      }
    } catch (err: any) {
      alert('Image upload failed: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePublishNewsArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsContent.trim()) {
      alert('Please enter a title and full article content.');
      return;
    }
    setNewsSubmitting(true);
    try {
      const { error } = await supabase.from('news_articles').insert({
        title: newsTitle.trim(),
        summary: newsSummary.trim() || newsTitle.trim(),
        content: newsContent.trim(),
        image_url: newsImageUrl.trim() || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop',
        category: newsCategory,
        source: newsSource.trim() || 'KNUST Wellness',
        is_pinned: newsIsPinned,
        read_time: '3 min read',
      });

      if (!error) {
        setNewsTitle('');
        setNewsSummary('');
        setNewsContent('');
        setNewsImageUrl('');
        setNewsIsPinned(false);
        loadData();
      } else {
        alert('Failed to publish article: ' + error.message);
      }
    } catch (err) {
      alert('Error publishing article.');
    } finally {
      setNewsSubmitting(false);
    }
  };

  const handleDeleteNewsArticle = async (id: string) => {
    if (!window.confirm('Delete this campus news article?')) return;
    try {
      await supabase.from('news_articles').delete().eq('id', id);
      loadData();
    } catch (err) {
      console.error('Error deleting article:', err);
    }
  };

  const handleNotifyCounselorsForOutreach = async (post: Post) => {
    if (!supabase) return;
    const studentName = post.profiles?.name || 'Student Member';
    const studentUserId = post.user_id;

    const confirmMsg = `Send urgent crisis outreach alert to ALL approved counselors regarding student "${studentName}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // Fetch all approved counselors
      const { data: counselorProfiles } = await supabase
        .from('counselor_profiles')
        .select('user_id')
        .eq('approval_status', 'approved');

      let counselorIds: string[] = [];
      if (counselorProfiles && counselorProfiles.length > 0) {
        counselorIds = counselorProfiles.map((c) => c.user_id);
      } else {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'counselor');
        counselorIds = profs?.map((p) => p.id) || ['kwame-boateng'];
      }

      if (counselorIds.length === 0) {
        alert('No active counselors found in database to receive notification.');
        return;
      }

      // Create notification rows for each counselor
      const notificationRows = counselorIds.map((counselorId) => ({
        user_id: counselorId,
        title: '🚨 Crisis Alert: Student Outreach Requested',
        body: `Admin requested immediate outreach for ${studentName}. Flagged post content: "${post.content}". Click to open direct support chat.`,
        link: `/chat/new?studentId=${studentUserId}&studentName=${encodeURIComponent(studentName)}`,
      }));

      const { error: notifErr } = await supabase.from('notifications').insert(notificationRows);
      if (notifErr) throw notifErr;

      const newReason = post.flag_reason
        ? `${post.flag_reason} (Outreach Alert Sent to ${counselorIds.length} Counselor${counselorIds.length === 1 ? '' : 's'})`
        : `Outreach Alert Sent to ${counselorIds.length} Counselor${counselorIds.length === 1 ? '' : 's'}`;

      await supabase
        .from('posts')
        .update({ flag_reason: newReason })
        .eq('id', post.id);

      setFlaggedContent((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, flag_reason: newReason } : p))
      );

      alert(`✅ Crisis outreach alert successfully sent to ${counselorIds.length} counselor(s)! They can now contact ${studentName} directly from their notifications.`);
    } catch (err: any) {
      alert('Failed to send counselor notification: ' + (err.message || err));
    }
  };

  const handleApproveCounselorApp = async (userId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('counselor_profiles')
        .update({ approval_status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      alert('Counselor application approved!');
      loadData();
    } catch (err: any) {
      alert('Approval error: ' + err.message);
    }
  };

  const handleRejectCounselorApp = async (userId: string) => {
    if (!supabase) return;
    const reason = window.prompt('Enter rejection reason for applicant:') || '';
    try {
      const { error } = await supabase
        .from('counselor_profiles')
        .update({ approval_status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
      alert('Counselor application set to rejected.');
      loadData();
    } catch (err: any) {
      alert('Rejection error: ' + err.message);
    }
  };

  // Counselors actions
  const handleApproveAppointment = async (apptId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'approved' })
        .eq('id', apptId);
      if (error) throw error;
      setAppointments(prev =>
        prev.map(a => a.id === apptId ? { ...a, status: 'approved' } : a)
      );
    } catch (err: any) {
      alert('Update failed: ' + err.message);
    }
  };

  const handleDeclineAppointment = async (apptId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'declined' })
        .eq('id', apptId);
      if (error) throw error;
      setAppointments(prev =>
        prev.map(a => a.id === apptId ? { ...a, status: 'declined' } : a)
      );
    } catch (err: any) {
      alert('Decline failed: ' + err.message);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setSendingBroadcast(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({ title: broadcastTitle.trim(), body: broadcastBody.trim() })
        .select()
        .maybeSingle();
      if (error) throw error;
      setAnnouncements(prev => [data, ...prev]);
      setBroadcastTitle('');
      setBroadcastBody('');
      alert('Announcement broadcasted successfully!');
    } catch (err: any) {
      alert('Broadcast failed: ' + err.message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Analytics Math
  const studentsCount = profiles.filter(p => p.role === 'student').length;
  const counselorsCount = profiles.filter(p => p.role === 'counselor').length;
  const flaggedCount = posts.filter(p => isPostFlagged(p.content)).length;
  const dbFlaggedCount = flaggedContent.filter(p => p.moderation_status === 'flagged').length;
  const dbBlockedCount = flaggedContent.filter(p => p.moderation_status === 'blocked').length;
  const escalationAlerts = announcements.filter(a => a.title.includes('Escalation'));
  const totalFlaggedBadge = flaggedContent.length + escalationAlerts.length;

  // Chart 1 Data: Mood logs count distribution
  const moodCounts = moodLogs.reduce((acc: Record<string, number>, log) => {
    acc[log.mood] = (acc[log.mood] || 0) + 1;
    return acc;
  }, {});

  const moodChartData = Object.entries(moodCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    Count: value
  }));

  // Chart 2 Data: Posts over last few days
  const postDates = posts.reduce((acc: Record<string, number>, p) => {
    const date = new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const postChartData = Object.entries(postDates).reverse().slice(-7).map(([date, count]) => ({
    Date: date,
    Posts: count
  }));

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#090C15] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md card-elevated rounded-2xl p-8 relative z-10 transition-all duration-300">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-[#131926] border border-white/10 p-2.5 flex items-center justify-center shadow-xl mb-4">
              <img
                src="/mindknust-logo.png"
                alt="MindKNUST Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">MindKNUST Portal</h1>
            <p className="text-slate-400 text-sm mt-1">Administrator Dashboard Control Panel</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@mindknust.edu.gh"
                className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl focus-ring text-sm transition-all duration-150 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Passcode / Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password or demo passcode"
                className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl focus-ring text-sm transition-all duration-150 placeholder:text-slate-500"
                autoFocus
              />
              {loginError ? (
                <div className="mt-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition-all duration-150 shadow-lg shadow-brand-500/25 text-sm mt-2 flex items-center justify-center gap-2"
            >
              <span>Access Dashboard</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/[0.06] text-center text-xs text-slate-400">
            Demo passcode: <span className="font-mono bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded text-slate-300">admin123</span> or <span className="font-mono bg-white/[0.04] border border-white/10 px-1.5 py-0.5 rounded text-slate-300">mindknust2026</span>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED DASHBOARD SHELL
  return (
    <div className="min-h-screen bg-[#090C15] text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0D111C] border-r border-white/[0.06] flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Header Brand */}
          <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#131926] border border-white/10 p-1.5 flex items-center justify-center shadow-md">
              <img
                src="/mindknust-logo.png"
                alt="MindKNUST Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 leading-tight text-sm tracking-tight">MindKNUST</h2>
              <span className="text-[11px] text-slate-400 font-medium">Admin Control</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1">
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Operations & Insights
            </div>

            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === 'overview'
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
              <span>Overview Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('moderation')}
              className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === 'moderation'
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>Feed Moderation</span>
              {flaggedCount > 0 && (
                <span className="ml-auto bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {flaggedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('flagged')}
              className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === 'flagged'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Flag className="w-4 h-4 flex-shrink-0" />
              <span>Flagged Content</span>
              {totalFlaggedBadge > 0 && (
                <span className="ml-auto bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {totalFlaggedBadge}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('counselors')}
              className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === 'counselors'
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>Appointments Slots</span>
            </button>

            {/* Section Divider & Label */}
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Content & Broadcasts</p>
            </div>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === 'notifications'
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Megaphone className="w-4 h-4 flex-shrink-0" />
              <span>Broadcast Alerts</span>
            </button>

            <button
              onClick={() => setActiveTab('news')}
              className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === 'news'
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Newspaper className="w-4 h-4 flex-shrink-0" />
              <span>Campus News & Insights</span>
            </button>
          </nav>
        </div>

        {/* Bottom Exit Portal Action */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={() => setIsLoggedIn(false)}
            className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Exit Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Apple HIG Frosted Glass Header Toolbar */}
        <header className="h-16 glass-header sticky top-0 z-20 flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-base text-slate-100 tracking-tight capitalize">
              {activeTab === 'counselors'
                ? 'Appointments & Slots'
                : activeTab === 'notifications'
                ? 'Broadcast Alerts'
                : activeTab === 'flagged'
                ? 'Flagged Content Review'
                : activeTab === 'news'
                ? 'Campus News & Insights Manager'
                : activeTab === 'moderation'
                ? 'Community Feed Moderation'
                : 'Overview & Campus Analytics'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-slate-200 px-3.5 py-1.5 rounded-xl border border-white/10 transition-all duration-150 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Force Sync</span>
            </button>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium tracking-tight">Live Database</span>
            </div>
          </div>
        </header>

        {/* Dashboard Worksheets */}
        <div className="flex-1 p-8 overflow-y-auto">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm">Synchronizing dashboard views...</p>
            </div>
          ) : loadError ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4 px-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <p className="text-slate-200 font-semibold">Could not load dashboard data</p>
              <p className="text-slate-400 text-sm text-center max-w-xl">{loadError}</p>
              <button
                onClick={loadData}
                className="mt-2 text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 text-slate-200 px-4 py-2 rounded-xl border border-white/10 transition-all duration-150"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & ANALYTICS */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Summary Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="card-surface p-6 rounded-2xl transition-all duration-200 hover:border-white/15">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Students</p>
                          <h3 className="text-3xl font-extrabold text-slate-50 tracking-tight mt-2">{studentsCount}</h3>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-brand-500/12 border border-brand-500/20 flex items-center justify-center text-brand-400 flex-shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="card-surface p-6 rounded-2xl transition-all duration-200 hover:border-white/15">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Staff</p>
                          <h3 className="text-3xl font-extrabold text-slate-50 tracking-tight mt-2">{counselorsCount}</h3>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/12 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="card-surface p-6 rounded-2xl transition-all duration-200 hover:border-white/15">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Feed Activity</p>
                          <h3 className="text-3xl font-extrabold text-slate-50 tracking-tight mt-2">{posts.length}</h3>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="card-surface p-6 rounded-2xl transition-all duration-200 hover:border-white/15">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Flagged Posts</p>
                          <h3 className="text-3xl font-extrabold text-rose-400 tracking-tight mt-2">{flaggedCount}</h3>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-rose-500/12 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Graphical Charts Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Mood Distribution Bar Chart */}
                    <div className="card-surface p-6 rounded-2xl">
                      <h4 className="font-semibold text-base text-slate-100 mb-6 flex items-center gap-2.5">
                        <TrendingUp className="w-4 h-4 text-brand-400" />
                        <span>Campus Emo-Index Distribution</span>
                      </h4>
                      {moodChartData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={moodChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={THEME.charts.gridStroke} vertical={false} />
                              <XAxis dataKey="name" stroke={THEME.charts.axisStroke} fontSize={11} tickLine={false} axisLine={{ stroke: THEME.charts.gridStroke }} />
                              <YAxis stroke={THEME.charts.axisStroke} fontSize={11} tickLine={false} axisLine={{ stroke: THEME.charts.gridStroke }} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Bar dataKey="Count" fill={THEME.colors.brand.DEFAULT} radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500 text-xs italic">
                          No logged emotional states query indexes recorded.
                        </div>
                      )}
                    </div>

                    {/* Timeline Line Chart */}
                    <div className="card-surface p-6 rounded-2xl">
                      <h4 className="font-semibold text-base text-slate-100 mb-6 flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>Post Activity (Last 7 Days)</span>
                      </h4>
                      {postChartData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={postChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={THEME.charts.gridStroke} vertical={false} />
                              <XAxis dataKey="Date" stroke={THEME.charts.axisStroke} fontSize={11} tickLine={false} axisLine={{ stroke: THEME.charts.gridStroke }} />
                              <YAxis stroke={THEME.charts.axisStroke} fontSize={11} tickLine={false} axisLine={{ stroke: THEME.charts.gridStroke }} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Line
                                type="monotone"
                                dataKey="Posts"
                                stroke={THEME.colors.emerald.DEFAULT}
                                strokeWidth={2.5}
                                dot={{ fill: THEME.colors.emerald.DEFAULT, r: 4 }}
                                activeDot={{ r: 6, stroke: '#131926', strokeWidth: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500 text-xs italic">
                          No feed timeline activities index recorded.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wellbeing Log Tracker list */}
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4 flex items-center gap-2.5">
                      <Heart className="w-4 h-4 text-rose-400" />
                      <span>Recent Student Wellbeing Logs</span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="py-3 px-4">Student ID</th>
                            <th className="py-3 px-4">Latest Logged Mood</th>
                            <th className="py-3 px-4">Note Context</th>
                            <th className="py-3 px-4 text-right">Log Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moodLogs.slice(0, 5).map((log) => (
                            <tr key={log.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs text-brand-400">{log.student_id}</td>
                              <td className="py-3.5 px-4 capitalize">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  ['sad', 'stressed', 'anxious'].includes(log.mood.toLowerCase())
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {log.mood}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 text-sm max-w-xs truncate">{log.note || 'No custom note.'}</td>
                              <td className="py-3.5 px-4 text-right text-slate-400 text-xs">
                                {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                              </td>
                            </tr>
                          ))}
                          {moodLogs.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500 text-xs italic">
                                No logs recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: POSTS MODERATION HUB */}
              {activeTab === 'moderation' && (
                <div className="space-y-6">
                  {/* Search and Filters Bar */}
                  <div className="card-surface p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        value={modSearch}
                        onChange={(e) => setModSearch(e.target.value)}
                        placeholder="Search posts or authors..."
                        className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 pl-10 pr-4 py-2.5 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedFilter('all')}
                        className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                          selectedFilter === 'all'
                            ? 'bg-brand-500/20 text-brand-300 border-brand-500/40 shadow-sm'
                            : 'bg-[#0A0E18] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                        }`}
                      >
                        All Posts ({posts.length})
                      </button>
                      <button
                        onClick={() => setSelectedFilter('flagged')}
                        className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                          selectedFilter === 'flagged'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                            : 'bg-[#0A0E18] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                        }`}
                      >
                        Flagged Keywords ({flaggedCount})
                      </button>
                    </div>
                  </div>

                  {/* Posts Cards lists */}
                  <div className="grid grid-cols-1 gap-4">
                    {filteredPosts.map((p) => {
                      const flagged = isPostFlagged(p.content);
                      return (
                        <div
                          key={p.id}
                          className={`card-surface p-6 rounded-2xl transition-all duration-200 ${
                            flagged ? 'border-rose-500/30 bg-rose-500/[0.03]' : 'hover:border-white/15'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-brand-500/12 border border-brand-500/20 flex items-center justify-center font-bold text-brand-300 text-sm flex-shrink-0">
                                {(p.profiles?.name || 'US').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-slate-100">{p.profiles?.name || 'Anonymous User'}</h5>
                                <span className="text-xs text-slate-400">
                                  {new Date(p.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {flagged && (
                                <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Contains Flagged Words
                                </span>
                              )}
                              <button
                                onClick={() => handleDeletePost(p.id)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all active:scale-95"
                                title="Moderate Post"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <p className="text-slate-200 text-sm mt-4 leading-relaxed">{p.content}</p>

                          {p.media_url && (
                            <div className="mt-4 max-w-sm rounded-xl overflow-hidden border border-white/10">
                              <img src={p.media_url} alt="Attached Media" className="w-full h-auto object-cover max-h-60" />
                            </div>
                          )}

                          <div className="flex gap-6 mt-4 text-xs text-slate-400 border-t border-white/[0.04] pt-3">
                            <span>Likes: <strong className="text-slate-200">{p.likes_count}</strong></span>
                            <span>Replies: <strong className="text-slate-200">{p.comments_count}</strong></span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredPosts.length === 0 && (
                      <div className="card-surface p-12 rounded-2xl text-center">
                        <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h5 className="font-semibold text-slate-200 text-base">Queue is Clear</h5>
                        <p className="text-slate-400 text-xs mt-1">No community posts match your moderation filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FLAGGED CONTENT MODERATION */}
              {activeTab === 'flagged' && (
                <div className="space-y-6">
                  {/* Summary Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card-surface border-amber-500/30 p-6 rounded-2xl transition-all">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Self-Harm Flagged</p>
                          <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{dbFlaggedCount}</h3>
                          <p className="text-slate-400 text-xs mt-1">Require counselor review</p>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-amber-500/12 border border-amber-500/25 flex items-center justify-center text-amber-400 flex-shrink-0">
                          <TriangleAlert className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="card-surface border-rose-500/30 p-6 rounded-2xl transition-all">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider">Blocked Posts</p>
                          <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{dbBlockedCount}</h3>
                          <p className="text-slate-400 text-xs mt-1">Profanity / guideline violations</p>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-rose-500/12 border border-rose-500/25 flex items-center justify-center text-rose-400 flex-shrink-0">
                          <Ban className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="card-surface border-orange-500/30 p-6 rounded-2xl transition-all">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Escalation Alerts</p>
                          <h3 className="text-3xl font-extrabold text-orange-400 mt-1">{escalationAlerts.length}</h3>
                          <p className="text-slate-400 text-xs mt-1">Negative mood streaks</p>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-orange-500/12 border border-orange-500/25 flex items-center justify-center text-orange-400 flex-shrink-0">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tab Filter Bar */}
                  <div className="flex gap-2">
                    {(['flagged', 'blocked', 'escalations'] as const).map((tab) => {
                      const labels: Record<string, string> = {
                        flagged: `Self-Harm Flagged (${dbFlaggedCount})`,
                        blocked: `Blocked Posts (${dbBlockedCount})`,
                        escalations: `Escalation Alerts (${escalationAlerts.length})`,
                      };
                      const activeColors: Record<string, string> = {
                        flagged: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm',
                        blocked: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm',
                        escalations: 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-sm',
                      };
                      return (
                        <button
                          key={tab}
                          onClick={() => setFlaggedSubTab(tab)}
                          className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                            flaggedSubTab === tab
                              ? activeColors[tab]
                              : 'bg-[#0A0E18] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                          }`}
                        >
                          {labels[tab]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Self-harm Flagged posts */}
                    {flaggedSubTab === 'flagged' && (
                      <>
                        {flaggedContent.filter(p => p.moderation_status === 'flagged').map((p) => (
                          <div key={p.id} className="card-surface border-amber-500/30 p-6 rounded-2xl">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-sm flex-shrink-0">
                                  {(p.profiles?.name || 'US').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h5 className="font-semibold text-sm text-slate-100">{p.profiles?.name || 'Anonymous User'}</h5>
                                  <span className="text-xs text-slate-400">
                                    {new Date(p.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                                <TriangleAlert className="w-3.5 h-3.5" />
                                Self-Harm Flagged
                              </span>
                            </div>

                            <p className="text-slate-200 text-sm mt-4 leading-relaxed bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3.5">
                              {p.content}
                            </p>

                            {p.flag_reason && (
                              <p className="text-xs text-amber-400/80 mt-2">Reason: {p.flag_reason}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-white/[0.04]">
                              <button
                                onClick={() => handleNotifyCounselorsForOutreach(p)}
                                className="min-h-[38px] flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-amber-500/20"
                              >
                                <Send className="w-3.5 h-3.5 text-slate-950" />
                                Alert Counselors to Contact Student
                              </button>
                              <button
                                onClick={() => handleApproveFlaggedPost(p.id)}
                                className="min-h-[38px] flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Approve & Restore
                              </button>
                              <button
                                onClick={() => handleDeleteFlaggedPost(p.id)}
                                className="min-h-[38px] flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-400 border border-rose-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Post
                              </button>
                              <span className="ml-auto text-xs text-slate-500">Likes: {p.likes_count}</span>
                            </div>
                          </div>
                        ))}
                        {flaggedContent.filter(p => p.moderation_status === 'flagged').length === 0 && (
                          <div className="card-surface p-12 rounded-2xl text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <h5 className="font-semibold text-slate-200 text-base">No Self-Harm Posts Flagged</h5>
                            <p className="text-slate-400 text-xs mt-1">The community is healthy. No self-harm content has been auto-flagged.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Blocked posts */}
                    {flaggedSubTab === 'blocked' && (
                      <>
                        {flaggedContent.filter(p => p.moderation_status === 'blocked').map((p) => (
                          <div key={p.id} className="card-surface border-rose-500/30 p-6 rounded-2xl">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center font-bold text-rose-400 text-sm flex-shrink-0">
                                  {(p.profiles?.name || 'US').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h5 className="font-semibold text-sm text-slate-100">{p.profiles?.name || 'Anonymous User'}</h5>
                                  <span className="text-xs text-slate-400">
                                    {new Date(p.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                                <Ban className="w-3.5 h-3.5" />
                                Blocked by Moderator
                              </span>
                            </div>

                            <p className="text-slate-300 text-sm mt-4 leading-relaxed bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-3.5 line-through decoration-rose-500/50">
                              {p.content}
                            </p>

                            {p.flag_reason && (
                              <p className="text-xs text-rose-400/80 mt-2">Violation: {p.flag_reason}</p>
                            )}

                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/[0.04]">
                              <button
                                onClick={() => handleApproveFlaggedPost(p.id)}
                                className="min-h-[38px] flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Override & Restore
                              </button>
                              <button
                                onClick={() => handleDeleteFlaggedPost(p.id)}
                                className="min-h-[38px] flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-400 border border-rose-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Permanently Delete
                              </button>
                            </div>
                          </div>
                        ))}
                        {flaggedContent.filter(p => p.moderation_status === 'blocked').length === 0 && (
                          <div className="card-surface p-12 rounded-2xl text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <h5 className="font-semibold text-slate-200 text-base">No Blocked Posts</h5>
                            <p className="text-slate-400 text-xs mt-1">No posts have been blocked by the auto-moderation engine.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Escalation Alerts */}
                    {flaggedSubTab === 'escalations' && (
                      <>
                        {escalationAlerts.map((alert) => (
                          <div key={alert.id} className="card-surface border-orange-500/30 p-6 rounded-2xl">
                            <div className="flex items-start gap-4">
                              <div className="w-11 h-11 rounded-xl bg-orange-500/12 border border-orange-500/25 flex items-center justify-center text-orange-400 flex-shrink-0">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <h5 className="font-semibold text-sm text-orange-300">{alert.title}</h5>
                                  <span className="text-xs text-slate-400 ml-4 flex-shrink-0">
                                    {new Date(alert.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-slate-200 text-sm mt-2 leading-relaxed">{alert.body}</p>
                                <div className="mt-3">
                                  <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                                    <TriangleAlert className="w-3.5 h-3.5" />
                                    Requires Counselor Action
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {escalationAlerts.length === 0 && (
                          <div className="card-surface p-12 rounded-2xl text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                            <h5 className="font-semibold text-slate-200 text-base">No Active Escalations</h5>
                            <p className="text-slate-400 text-xs mt-1">No student has triggered the 3-day consecutive negative mood escalation rule.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: COUNSELORS & APPOINTMENT SLOTS APPROVAL */}
              {activeTab === 'counselors' && (
                <div className="space-y-6">
                  {/* Counselor Applications Review Table */}
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4 flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-brand-400" />
                      <span>Counselor Applications Approvals Queue</span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="py-3 px-4">Applicant</th>
                            <th className="py-3 px-4">License #</th>
                            <th className="py-3 px-4">Qualification</th>
                            <th className="py-3 px-4">Specializations</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {counselorApps.map((cApp) => (
                            <tr key={cApp.user_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="py-3.5 px-4 font-semibold text-sm text-slate-100">
                                {cApp.profile?.name || cApp.user_id}
                                <div className="text-xs text-slate-400 font-normal">{cApp.profile?.email}</div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                                {cApp.license_number}
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 text-xs">
                                {cApp.qualification}
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 text-xs">
                                {Array.isArray(cApp.specializations) ? cApp.specializations.join(', ') : cApp.specializations}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  cApp.approval_status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : cApp.approval_status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {cApp.approval_status || 'pending'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-2">
                                  {cApp.approval_status !== 'approved' && (
                                    <button
                                      onClick={() => handleApproveCounselorApp(cApp.user_id)}
                                      className="min-h-[36px] bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl shadow-sm shadow-brand-500/25 transition-all inline-flex items-center gap-1.5"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Approve
                                    </button>
                                  )}
                                  {cApp.approval_status !== 'rejected' && (
                                    <button
                                      onClick={() => handleRejectCounselorApp(cApp.user_id)}
                                      className="min-h-[36px] bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-400 border border-rose-500/30 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {counselorApps.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500 text-xs italic">
                                No pending counselor applications in review queue.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Appointment approval table */}
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4 flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-brand-400" />
                      <span>Counseling Appointments Approvals Queue</span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="py-3 px-4">Student ID</th>
                            <th className="py-3 px-4">Counselor</th>
                            <th className="py-3 px-4">Appointment Date</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointments.map((appt) => (
                            <tr key={appt.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                                {appt.student_profile?.name || appt.student_id}
                              </td>
                              <td className="py-3.5 px-4 text-slate-200">
                                {appt.counselor_profile?.name || appt.counselor_id}
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 text-sm">
                                {new Date(appt.appointment_date).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  appt.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : appt.status === 'declined'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {appt.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-2">
                                  {appt.status !== 'approved' && (
                                    <button
                                      onClick={() => handleApproveAppointment(appt.id)}
                                      className="min-h-[36px] bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl shadow-sm shadow-brand-500/25 transition-all inline-flex items-center gap-1.5"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Approve Slot
                                    </button>
                                  )}
                                  {appt.status !== 'declined' && appt.status !== 'approved' && (
                                    <button
                                      onClick={() => handleDeclineAppointment(appt.id)}
                                      className="min-h-[36px] bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-400 border border-rose-500/30 font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      Decline Slot
                                    </button>
                                  )}
                                  {appt.status === 'approved' && (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Approved
                                    </span>
                                  )}
                                  {appt.status === 'declined' && (
                                    <span className="inline-flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
                                      <Ban className="w-3.5 h-3.5" />
                                      Declined
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {appointments.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 text-xs italic">
                                No appointments slots pending approval records.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: BROADCAST ANNOUNCEMENTS */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4 flex items-center gap-2.5">
                      <Megaphone className="w-4 h-4 text-brand-400" />
                      <span>Broadcast App-Wide Announcement</span>
                    </h4>
                    <form onSubmit={handleBroadcast} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                          Announcement Title
                        </label>
                        <input
                          type="text"
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value)}
                          placeholder="e.g. Campus Counselors Update"
                          className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                          Announcement Message Body
                        </label>
                        <textarea
                          value={broadcastBody}
                          onChange={(e) => setBroadcastBody(e.target.value)}
                          placeholder="Type details for all KNUST student members..."
                          rows={4}
                          className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastBody.trim()}
                        className="min-h-[44px] bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>{sendingBroadcast ? 'Broadcasting...' : 'Send Announcement'}</span>
                      </button>
                    </form>
                  </div>

                  {/* Sent Announcements List */}
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4">Past Broadcast Announcements</h4>
                    <div className="space-y-4">
                      {announcements.map((ann) => (
                        <div key={ann.id} className="border-b border-white/[0.04] pb-4 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-start">
                            <h5 className="font-semibold text-slate-100 text-sm">{ann.title}</h5>
                            <span className="text-xs text-slate-400">
                              {new Date(ann.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">{ann.body}</p>
                        </div>
                      ))}
                      {announcements.length === 0 && (
                        <div className="text-center py-6 text-slate-500 text-xs italic">
                          No previous app-wide announcements broadcasted.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: CAMPUS NEWS & INSIGHTS */}
              {activeTab === 'news' && (
                <div className="space-y-6">
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4 flex items-center gap-2.5">
                      <Newspaper className="w-4 h-4 text-brand-400" />
                      <span>Publish Campus News & Wellness Insight</span>
                    </h4>
                    <form onSubmit={handlePublishNewsArticle} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Article Title *
                          </label>
                          <input
                            type="text"
                            value={newsTitle}
                            onChange={(e) => setNewsTitle(e.target.value)}
                            placeholder="e.g. KNUST Wellness Center Open House"
                            className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Category
                          </label>
                          <select
                            value={newsCategory}
                            onChange={(e: any) => setNewsCategory(e.target.value)}
                            className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring transition-all cursor-pointer"
                          >
                            <option value="Campus News" className="bg-[#192030] text-slate-100">Campus News</option>
                            <option value="Mental Health" className="bg-[#192030] text-slate-100">Mental Health</option>
                            <option value="Self-Care" className="bg-[#192030] text-slate-100">Self-Care</option>
                            <option value="Academic Stress" className="bg-[#192030] text-slate-100">Academic Stress</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Cover Image
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newsImageUrl}
                              onChange={(e) => setNewsImageUrl(e.target.value)}
                              placeholder="Image URL or choose file below..."
                              className="flex-1 bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all"
                            />
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={uploadingImage}
                              />
                              <button
                                type="button"
                                className="h-full min-h-[44px] bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center whitespace-nowrap active:scale-95"
                              >
                                {uploadingImage ? 'Uploading...' : 'Upload Image'}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Source / Author
                          </label>
                          <input
                            type="text"
                            value={newsSource}
                            onChange={(e) => setNewsSource(e.target.value)}
                            placeholder="e.g. KNUST Counseling Center"
                            className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                          Short Summary
                        </label>
                        <input
                          type="text"
                          value={newsSummary}
                          onChange={(e) => setNewsSummary(e.target.value)}
                          placeholder="Brief preview snippet..."
                          className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                          Full Article Content *
                        </label>
                        <textarea
                          value={newsContent}
                          onChange={(e) => setNewsContent(e.target.value)}
                          placeholder="Write full article details..."
                          rows={5}
                          className="w-full bg-[#0A0E18] border border-white/10 text-slate-100 px-4 py-3 rounded-xl text-sm focus-ring placeholder:text-slate-500 transition-all resize-none"
                        />
                      </div>

                      <div className="flex items-center gap-2.5 py-1">
                        <input
                          type="checkbox"
                          id="webPin"
                          checked={newsIsPinned}
                          onChange={(e) => setNewsIsPinned(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-[#0A0E18] text-brand-500 focus:ring-brand-500/40 cursor-pointer"
                        />
                        <label htmlFor="webPin" className="text-sm text-slate-300 font-medium cursor-pointer select-none">
                          Pin Article to Top Spotlight Hero
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={newsSubmitting || !newsTitle.trim() || !newsContent.trim()}
                        className="min-h-[44px] bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>{newsSubmitting ? 'Publishing Article...' : 'Publish Campus Article'}</span>
                      </button>
                    </form>
                  </div>

                  {/* Published News Articles List */}
                  <div className="card-surface p-6 rounded-2xl">
                    <h4 className="font-semibold text-base text-slate-100 mb-4">Published Campus Articles</h4>
                    <div className="space-y-4">
                      {newsArticles.map((article) => (
                        <div key={article.id} className="border-b border-white/[0.04] pb-4 last:border-b-0 last:pb-0 flex items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="bg-brand-500/10 text-brand-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-brand-500/20">
                                {article.category}
                              </span>
                              {article.is_pinned && (
                                <span className="bg-amber-500/10 text-amber-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                  Pinned
                                </span>
                              )}
                              <span className="text-xs text-slate-400">{new Date(article.created_at).toLocaleDateString()}</span>
                            </div>
                            <h5 className="font-semibold text-slate-100 text-base">{article.title}</h5>
                            <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">{article.summary}</p>
                            <span className="text-xs text-slate-400 font-medium block">Source: {article.source}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteNewsArticle(article.id)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all flex-shrink-0"
                            title="Delete article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {newsArticles.length === 0 && (
                        <div className="text-center py-6 text-slate-500 text-xs italic">
                          No campus news articles published yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
