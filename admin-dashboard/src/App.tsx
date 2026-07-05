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
  Lock,
  Megaphone,
  Flag,
  Ban,
  TriangleAlert,
  ShieldCheck,
  Eye
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
import { supabase } from './supabase';

// Type definitions
interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
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

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'flagged' | 'counselors' | 'notifications'>('overview');

  // Database States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [flaggedContent, setFlaggedContent] = useState<FlaggedContent[]>([]);
  const [loading, setLoading] = useState(true);

  // Flagged Content sub-filter
  const [flaggedSubTab, setFlaggedSubTab] = useState<'flagged' | 'blocked' | 'escalations'>('flagged');

  // Broadcast Notification Form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Search & Filter States
  const [modSearch, setModSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'flagged'>('all');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123' || password === 'mindknust2026') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid Administrator Passcode.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setProfiles(profData || []);

      // 2. Fetch posts
      const { data: postData } = await supabase
        .from('posts')
        .select('*, profiles:user_id(name, role)')
        .order('created_at', { ascending: false });
      setPosts(postData || []);

      // 3. Fetch mood logs
      const { data: moodData } = await supabase
        .from('mood_logs')
        .select('*')
        .order('created_at', { ascending: false });
      setMoodLogs(moodData || []);

      // 4. Fetch appointments
      const { data: apptData } = await supabase
        .from('appointments')
        .select(`
          *,
          student_profile:student_id(name),
          counselor_profile:counselor_id(name)
        `)
        .order('appointment_date', { ascending: false });
      setAppointments(apptData || []);

      // 5. Fetch announcements
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      setAnnouncements(notifData || []);

      // 6. Fetch flagged/blocked posts from moderation engine
      const { data: flagData } = await supabase
        .from('posts')
        .select('*, profiles:user_id(name, role)')
        .in('moderation_status', ['flagged', 'blocked'])
        .order('created_at', { ascending: false });
      setFlaggedContent((flagData || []) as FlaggedContent[]);

    } catch (err) {
      console.error('Error fetching database tables:', err);
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

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;
    setSendingBroadcast(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({ title: broadcastTitle.trim(), body: broadcastBody.trim() })
        .select()
        .single();
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-brand-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">CounselCare Portal</h1>
            <p className="text-slate-400 text-sm mt-1">Administrator Dashboard Control Panel</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Administrator Passcode
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin passcode"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-3 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
                autoFocus
              />
              {loginError ? (
                <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {loginError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-brand-600/20"
            >
              Access Dashboard
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-500">
            Demo passcode: <span className="font-mono text-slate-400">admin123</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 leading-tight">CounselCare</h2>
            <span className="text-xs text-slate-500">Admin Control</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview Analytics
          </button>

          <button
            onClick={() => setActiveTab('moderation')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'moderation'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Feed Moderation
            {flaggedCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {flaggedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('flagged')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'flagged'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Flag className="w-4 h-4" />
            Flagged Content
            {totalFlaggedBadge > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {totalFlaggedBadge}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('counselors')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'counselors'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Appointments slots
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'notifications'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Broadcast Alerts
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => setIsLoggedIn(false)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Exit Portal
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header toolbar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg text-slate-100 capitalize">
              {activeTab === 'counselors' ? 'Appointments & Slots' : activeTab === 'notifications' ? 'Broadcast Alerts' : activeTab === 'flagged' ? 'Flagged Content Review' : activeTab}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadData}
              className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              Force Sync
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">Live Database</span>
            </div>
          </div>
        </header>

        {/* Dashboard Worksheets */}
        <div className="flex-1 p-8 overflow-y-auto">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm">Synchronizing dashboard views...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & ANALYTICS */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Summary Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Students</p>
                          <h3 className="text-3xl font-black text-slate-100 mt-2">{studentsCount}</h3>
                        </div>
                        <div className="p-3 bg-brand-500/10 rounded-xl">
                          <Users className="w-5 h-5 text-brand-500" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Staff</p>
                          <h3 className="text-3xl font-black text-slate-100 mt-2">{counselorsCount}</h3>
                        </div>
                        <div className="p-3 bg-indigo-500/10 rounded-xl">
                          <UserCheck className="w-5 h-5 text-indigo-500" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Feed Activity</p>
                          <h3 className="text-3xl font-black text-slate-100 mt-2">{posts.length}</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                          <MessageSquare className="w-5 h-5 text-emerald-500" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Flagged Posts</p>
                          <h3 className="text-3xl font-black text-red-400 mt-2">{flaggedCount}</h3>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-xl">
                          <ShieldAlert className="w-5 h-5 text-red-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Graphical Charts Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Mood Distribution Bar Chart */}
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <h4 className="font-bold text-slate-200 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-brand-500" />
                        Campus Emo-Index Distribution
                      </h4>
                      {moodChartData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={moodChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                              <Bar dataKey="Count" fill="#5b3fe0" radius={[4, 4, 0, 0]} />
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
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <h4 className="font-bold text-slate-200 mb-6 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        Post Activity (Last 7 Days)
                      </h4>
                      {postChartData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={postChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="Date" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                              <Line type="monotone" dataKey="Posts" stroke="#10b981" strokeWidth={2} activeDot={{ r: 6 }} />
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
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h4 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-400" />
                      Recent Student Wellbeing Logs
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                            <th className="py-3 px-4">Student ID</th>
                            <th className="py-3 px-4">Latest Logged Mood</th>
                            <th className="py-3 px-4">Note Context</th>
                            <th className="py-3 px-4 text-right">Log Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {moodLogs.slice(0, 5).map((log) => (
                            <tr key={log.id} className="border-b border-slate-850 hover:bg-slate-800/20 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs text-brand-400">{log.student_id}</td>
                              <td className="py-3.5 px-4 capitalize">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  ['sad', 'stressed', 'anxious'].includes(log.mood.toLowerCase())
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {log.mood}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 text-sm max-w-xs truncate">{log.note || 'No custom note.'}</td>
                              <td className="py-3.5 px-4 text-right text-slate-500 text-xs">
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
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                      <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        value={modSearch}
                        onChange={(e) => setModSearch(e.target.value)}
                        placeholder="Search posts or authors..."
                        className="w-full bg-slate-950 border border-slate-850 text-slate-100 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedFilter('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          selectedFilter === 'all'
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All Posts ({posts.length})
                      </button>
                      <button
                        onClick={() => setSelectedFilter('flagged')}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          selectedFilter === 'flagged'
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
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
                          className={`bg-slate-900 border p-6 rounded-2xl transition-all ${
                            flagged ? 'border-red-500/30 bg-red-950/5' : 'border-slate-800'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-brand-400 text-sm">
                                {(p.profiles?.name || 'US').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-slate-200">{p.profiles?.name || 'Anonymous User'}</h5>
                                <span className="text-xs text-slate-500">
                                  {new Date(p.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              {flagged && (
                                <span className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Contains Flagged Words
                                </span>
                              )}
                              <button
                                onClick={() => handleDeletePost(p.id)}
                                className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-colors"
                                title="Moderate Post"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <p className="text-slate-300 text-sm mt-4 leading-relaxed">{p.content}</p>

                          {p.media_url && (
                            <div className="mt-4 max-w-sm rounded-xl overflow-hidden border border-slate-800">
                              <img src={p.media_url} alt="Attached Media" className="w-full h-auto object-cover max-h-60" />
                            </div>
                          )}

                          <div className="flex gap-6 mt-4 text-xs text-slate-500 border-t border-slate-850/50 pt-3">
                            <span>Likes: <strong className="text-slate-300">{p.likes_count}</strong></span>
                            <span>Replies: <strong className="text-slate-300">{p.comments_count}</strong></span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredPosts.length === 0 && (
                      <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center">
                        <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h5 className="font-bold text-slate-300">Queue is Clear</h5>
                        <p className="text-slate-500 text-xs mt-1">No community posts match your moderation filters.</p>
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
                    <div className="bg-slate-900 border border-amber-500/20 p-5 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">Self-Harm Flagged</p>
                          <h3 className="text-3xl font-black text-amber-400 mt-1">{dbFlaggedCount}</h3>
                          <p className="text-slate-500 text-xs mt-1">Require counselor review</p>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-xl">
                          <TriangleAlert className="w-6 h-6 text-amber-400" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-red-500/20 p-5 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Blocked Posts</p>
                          <h3 className="text-3xl font-black text-red-400 mt-1">{dbBlockedCount}</h3>
                          <p className="text-slate-500 text-xs mt-1">Profanity / guideline violations</p>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-xl">
                          <Ban className="w-6 h-6 text-red-400" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-orange-500/20 p-5 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">Escalation Alerts</p>
                          <h3 className="text-3xl font-black text-orange-400 mt-1">{escalationAlerts.length}</h3>
                          <p className="text-slate-500 text-xs mt-1">Negative mood streaks</p>
                        </div>
                        <div className="p-3 bg-orange-500/10 rounded-xl">
                          <ShieldAlert className="w-6 h-6 text-orange-400" />
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
                      const colors: Record<string, string> = {
                        flagged: 'bg-amber-600 border-amber-500 text-white',
                        blocked: 'bg-red-600 border-red-500 text-white',
                        escalations: 'bg-orange-600 border-orange-500 text-white',
                      };
                      return (
                        <button
                          key={tab}
                          onClick={() => setFlaggedSubTab(tab)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            flaggedSubTab === tab
                              ? colors[tab]
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
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
                          <div key={p.id} className="bg-slate-900 border border-amber-500/25 bg-amber-950/5 p-6 rounded-2xl">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center font-bold text-amber-400 text-sm">
                                  {(p.profiles?.name || 'US').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h5 className="font-bold text-sm text-slate-200">{p.profiles?.name || 'Anonymous User'}</h5>
                                  <span className="text-xs text-slate-500">
                                    {new Date(p.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                  <TriangleAlert className="w-3 h-3" />
                                  Self-Harm Flagged
                                </span>
                              </div>
                            </div>

                            <p className="text-slate-300 text-sm mt-4 leading-relaxed bg-amber-950/20 border border-amber-500/10 rounded-xl p-3">{p.content}</p>

                            {p.flag_reason && (
                              <p className="text-xs text-amber-400/70 mt-2">Reason: {p.flag_reason}</p>
                            )}

                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800/50">
                              <button
                                onClick={() => handleApproveFlaggedPost(p.id)}
                                className="flex items-center gap-1.5 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Approve & Restore
                              </button>
                              <button
                                onClick={() => handleDeleteFlaggedPost(p.id)}
                                className="flex items-center gap-1.5 bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Post
                              </button>
                              <span className="ml-auto text-xs text-slate-600">Likes: {p.likes_count}</span>
                            </div>
                          </div>
                        ))}
                        {flaggedContent.filter(p => p.moderation_status === 'flagged').length === 0 && (
                          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                            <h5 className="font-bold text-slate-300">No Self-Harm Posts Flagged</h5>
                            <p className="text-slate-500 text-xs mt-1">The community is healthy. No self-harm content has been auto-flagged.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Blocked posts */}
                    {flaggedSubTab === 'blocked' && (
                      <>
                        {flaggedContent.filter(p => p.moderation_status === 'blocked').map((p) => (
                          <div key={p.id} className="bg-slate-900 border border-red-500/25 bg-red-950/5 p-6 rounded-2xl">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center font-bold text-red-400 text-sm">
                                  {(p.profiles?.name || 'US').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h5 className="font-bold text-sm text-slate-200">{p.profiles?.name || 'Anonymous User'}</h5>
                                  <span className="text-xs text-slate-500">
                                    {new Date(p.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                <Ban className="w-3 h-3" />
                                Blocked by Moderator
                              </span>
                            </div>

                            <p className="text-slate-400 text-sm mt-4 leading-relaxed bg-red-950/20 border border-red-500/10 rounded-xl p-3 line-through decoration-red-700/50">{p.content}</p>

                            {p.flag_reason && (
                              <p className="text-xs text-red-400/70 mt-2">Violation: {p.flag_reason}</p>
                            )}

                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800/50">
                              <button
                                onClick={() => handleApproveFlaggedPost(p.id)}
                                className="flex items-center gap-1.5 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Override & Restore
                              </button>
                              <button
                                onClick={() => handleDeleteFlaggedPost(p.id)}
                                className="flex items-center gap-1.5 bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Permanently Delete
                              </button>
                            </div>
                          </div>
                        ))}
                        {flaggedContent.filter(p => p.moderation_status === 'blocked').length === 0 && (
                          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                            <h5 className="font-bold text-slate-300">No Blocked Posts</h5>
                            <p className="text-slate-500 text-xs mt-1">No posts have been blocked by the auto-moderation engine.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Escalation Alerts */}
                    {flaggedSubTab === 'escalations' && (
                      <>
                        {escalationAlerts.map((alert) => (
                          <div key={alert.id} className="bg-slate-900 border border-orange-500/25 bg-orange-950/5 p-6 rounded-2xl">
                            <div className="flex items-start gap-4">
                              <div className="p-3 bg-orange-500/10 rounded-xl flex-shrink-0">
                                <ShieldAlert className="w-5 h-5 text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <h5 className="font-bold text-sm text-orange-300">{alert.title}</h5>
                                  <span className="text-xs text-slate-500 ml-4 flex-shrink-0">
                                    {new Date(alert.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-sm mt-2 leading-relaxed">{alert.body}</p>
                                <div className="mt-3">
                                  <span className="inline-flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    <TriangleAlert className="w-3 h-3" />
                                    Requires Counselor Action
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {escalationAlerts.length === 0 && (
                          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                            <h5 className="font-bold text-slate-300">No Active Escalations</h5>
                            <p className="text-slate-500 text-xs mt-1">No student has triggered the 3-day consecutive negative mood escalation rule.</p>
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
                  {/* Appointment approval table */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h4 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-500" />
                      Counseling Appointments Approvals Queue
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                            <th className="py-3 px-4">Student ID</th>
                            <th className="py-3 px-4">Counselor</th>
                            <th className="py-3 px-4">Appointment Date</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointments.map((appt) => (
                            <tr key={appt.id} className="border-b border-slate-850 hover:bg-slate-800/20 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                                {appt.student_profile?.name || appt.student_id}
                              </td>
                              <td className="py-3.5 px-4 text-slate-300">
                                {appt.counselor_profile?.name || appt.counselor_id}
                              </td>
                              <td className="py-3.5 px-4 text-slate-300 text-sm">
                                {new Date(appt.appointment_date).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  appt.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-emerald-500/20'
                                }`}>
                                  {appt.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {appt.status === 'pending' ? (
                                  <button
                                    onClick={() => handleApproveAppointment(appt.id)}
                                    className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    Approve Slot
                                  </button>
                                ) : (
                                  <span className="text-slate-500 text-xs">Approved</span>
                                )}
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

              {/* TAB 4: BROADCAST ANNOUNCEMENTS */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h4 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-brand-500" />
                      Broadcast App-Wide Announcement
                    </h4>
                    <form onSubmit={handleBroadcast} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Announcement Title
                        </label>
                        <input
                          type="text"
                          value={broadcastTitle}
                          onChange={(e) => setBroadcastTitle(e.target.value)}
                          placeholder="e.g. Campus Counselors Update"
                          className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Announcement Message Body
                        </label>
                        <textarea
                          value={broadcastBody}
                          onChange={(e) => setBroadcastBody(e.target.value)}
                          placeholder="Type details for all KNUST student members..."
                          rows={4}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastBody.trim()}
                        className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-600/10 disabled:opacity-50"
                      >
                        {sendingBroadcast ? 'Broadcasting...' : 'Send Announcement'}
                      </button>
                    </form>
                  </div>

                  {/* Sent Announcements List */}
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h4 className="font-bold text-slate-200 mb-4">Past Broadcast Announcements</h4>
                    <div className="space-y-4">
                      {announcements.map((ann) => (
                        <div key={ann.id} className="border-b border-slate-800/50 pb-4 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-start">
                            <h5 className="font-bold text-slate-200 text-sm">{ann.title}</h5>
                            <span className="text-xs text-slate-500">
                              {new Date(ann.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1 leading-relaxed">{ann.body}</p>
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
