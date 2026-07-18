import { supabase, hasSupabaseConfig } from './supabase';
import { analyzeSentiment, moderateContent } from './sentiment';

export interface SupabaseProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'counselor';
  avatar_url?: string;
  created_at: string;
}

export interface SupabaseCounselor {
  id: string;
  specialties: string[];
  rating: number;
  note: string;
  bio: string;
  profile?: SupabaseProfile;
}

export interface SupabaseSlot {
  id: string;
  counselor_id: string;
  day_of_week: string;
  time_slot: string;
}

export interface SupabaseAppointment {
  id: string;
  student_id: string;
  counselor_id: string;
  appointment_date: string;
  time_slot: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  topic: string;
  student_profile?: SupabaseProfile;
  counselor_profile?: SupabaseProfile;
}

export interface SupabaseChat {
  id: string;
  student_id: string;
  counselor_id: string;
  last_message: string;
  last_message_at: string;
  student_profile?: SupabaseProfile;
  counselor_profile?: SupabaseProfile;
}

export interface SupabaseMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  delivered_at?: string;
  read_at?: string;
}

export interface SupabaseMoodLog {
  id: string;
  student_id: string;
  mood: string;
  note: string;
  created_at: string;
  sentiment_score?: number;
  sentiment_label?: 'positive' | 'neutral' | 'negative';
  is_flagged?: boolean;
}

// ------------------------------
// PROFILES
// ------------------------------
export async function upsertProfile(
  id: string,
  name: string,
  email: string,
  role: 'student' | 'counselor',
  avatarUrl?: string
): Promise<SupabaseProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id, name, email, role, avatar_url: avatarUrl })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error upserting profile:', error);
    throw error;
  }
  return data;
}

// ------------------------------
// COUNSELORS
// ------------------------------
export async function fetchCounselors(): Promise<SupabaseCounselor[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data: counselorData, error: counselorError } = await supabase
    .from('counselors')
    .select(`
      id, specialties, rating, note, bio,
      profile:profiles (id, name, email, role, avatar_url)
    `);

  if (counselorError) {
    console.error('Error fetching counselors:', counselorError);
    throw counselorError;
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email, role, avatar_url, created_at')
    .eq('role', 'counselor');

  if (profileError) {
    console.error('Error fetching counselor profiles:', profileError);
    return (counselorData || []) as unknown as SupabaseCounselor[];
  }

  const existingIds = new Set(counselorData?.map(c => c.id) || []);
  const list = [...(counselorData || [])] as unknown as SupabaseCounselor[];

  for (const prof of (profileData || [])) {
    if (!existingIds.has(prof.id)) {
      list.push({
        id: prof.id,
        specialties: ['General Support', 'Peer Connection'],
        rating: 5.0,
        note: 'Ready to connect.',
        bio: 'KNUST Student Support Counselor.',
        profile: prof
      });
    }
  }

  return list;
}

export async function fetchCounselorDetail(id: string): Promise<SupabaseCounselor | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('counselors')
    .select(`
      id, specialties, rating, note, bio,
      profile:profiles (id, name, email, role, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching counselor detail:', error);
  }

  if (data) {
    return data as unknown as SupabaseCounselor;
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, name, email, role, avatar_url, created_at')
    .eq('id', id)
    .eq('role', 'counselor')
    .maybeSingle();

  if (prof) {
    return {
      id: prof.id,
      specialties: ['General Support', 'Peer Connection'],
      rating: 5.0,
      note: 'Ready to connect.',
      bio: 'KNUST Student Support Counselor.',
      profile: prof
    };
  }

  return null;
}

export async function createCounselorMetadata(
  id: string,
  specialties: string[] = [],
  note: string = '',
  bio: string = ''
): Promise<SupabaseCounselor | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('counselors')
    .insert({ id, specialties, rating: 5.00, note, bio })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating counselor metadata:', error);
    throw error;
  }
  return data;
}

export async function updateCounselorMetadata(
  id: string,
  specialties: string[],
  note: string,
  bio: string
): Promise<SupabaseCounselor | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('counselors')
    .update({ specialties, note, bio })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating counselor metadata:', error);
    throw error;
  }
  return data;
}

// ------------------------------
// AVAILABILITY SLOTS
// ------------------------------
export async function fetchAvailabilitySlots(counselorId: string): Promise<SupabaseSlot[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('counselor_id', counselorId)
    .order('day_of_week', { ascending: true });

  if (error) {
    console.error('Error fetching availability slots:', error);
    throw error;
  }
  return data || [];
}

export async function addAvailabilitySlot(
  counselorId: string,
  dayOfWeek: string,
  timeSlot: string
): Promise<SupabaseSlot | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('availability_slots')
    .insert({ counselor_id: counselorId, day_of_week: dayOfWeek, time_slot: timeSlot })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error adding availability slot:', error);
    throw error;
  }
  return data;
}

export async function deleteAvailabilitySlot(slotId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const { error } = await supabase
    .from('availability_slots')
    .delete()
    .eq('id', slotId);

  if (error) {
    console.error('Error deleting availability slot:', error);
    throw error;
  }
  return true;
}

// ------------------------------
// APPOINTMENTS
// ------------------------------
export async function fetchAppointments(
  userId: string,
  role: 'student' | 'counselor'
): Promise<SupabaseAppointment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const field = role === 'student' ? 'student_id' : 'counselor_id';
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, student_id, counselor_id, appointment_date, time_slot, status, topic,
      student_profile:profiles!appointments_student_id_fkey(id, name, email, avatar_url),
      counselor_profile:profiles!appointments_counselor_id_fkey(id, name, email, avatar_url)
    `)
    .eq(field, userId)
    .order('appointment_date', { ascending: true });

  if (error) {
    console.error('Error fetching appointments:', error);
    throw error;
  }
  return (data || []) as unknown as SupabaseAppointment[];
}

export async function createAppointment(
  studentId: string,
  counselorId: string,
  date: string,
  timeSlot: string,
  topic: string
): Promise<SupabaseAppointment | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      student_id: studentId,
      counselor_id: counselorId,
      appointment_date: date,
      time_slot: timeSlot,
      topic,
      status: 'pending',
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating appointment:', error);
    throw error;
  }
  return data;
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'accepted' | 'declined' | 'completed'
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId);

  if (error) {
    console.error('Error updating appointment:', error);
    throw error;
  }
  return true;
}

export async function fetchUserChats(userId: string, role: 'student' | 'counselor'): Promise<SupabaseChat[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const field = role === 'student' ? 'student_id' : 'counselor_id';
  const { data, error } = await supabase
    .from('chats')
    .select(`
      id, student_id, counselor_id, last_message, last_message_at,
      student_profile:profiles!chats_student_id_fkey(id, name, email, avatar_url),
      counselor_profile:profiles!chats_counselor_id_fkey(id, name, email, avatar_url)
    `)
    .eq(field, userId)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('Error fetching user chats:', error);
    throw error;
  }
  return (data || []) as unknown as SupabaseChat[];
}

export async function fetchOrCreateChat(studentId: string, counselorId: string): Promise<SupabaseChat | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  // Attempt to fetch existing chat
  const { data: existing, error: fetchError } = await supabase
    .from('chats')
    .select(`
      id, student_id, counselor_id, last_message, last_message_at,
      student_profile:profiles!chats_student_id_fkey(id, name, email, avatar_url),
      counselor_profile:profiles!chats_counselor_id_fkey(id, name, email, avatar_url)
    `)
    .eq('student_id', studentId)
    .eq('counselor_id', counselorId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching chat:', fetchError);
    throw fetchError;
  }

  if (existing) {
    return existing as unknown as SupabaseChat;
  }

  // Create new chat
  const { data: created, error: createError } = await supabase
    .from('chats')
    .insert({ student_id: studentId, counselor_id: counselorId })
    .select(`
      id, student_id, counselor_id, last_message, last_message_at,
      student_profile:profiles!chats_student_id_fkey(id, name, email, avatar_url),
      counselor_profile:profiles!chats_counselor_id_fkey(id, name, email, avatar_url)
    `)
    .maybeSingle();

  if (createError) {
    console.error('Error creating chat:', createError);
    throw createError;
  }
  return created as unknown as SupabaseChat;
}

export async function fetchMessages(chatId: string): Promise<SupabaseMessage[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
  return data || [];
}

export async function sendMessage(chatId: string, senderId: string, text: string): Promise<SupabaseMessage | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  // Insert individual message
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      text,
      delivered_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error inserting message:', error);
    throw error;
  }

  // Update chat metadata block
  await supabase
    .from('chats')
    .update({ last_message: text, last_message_at: new Date().toISOString() })
    .eq('id', chatId);

  return data;
}

export async function markMessagesAsRead(chatId: string, userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('Error marking messages as read:', error);
  }
}

// ------------------------------
// MOOD LOGS
// ------------------------------
export async function insertMoodLog(studentId: string, mood: string, note: string): Promise<SupabaseMoodLog | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  // Run ML sentiment analyzer (HF API → keyword fallback)
  const sentiment = await analyzeSentiment(note);

  const { data, error } = await supabase
    .from('mood_logs')
    .insert({
      student_id: studentId,
      mood,
      note,
      sentiment_score: sentiment.score,
      sentiment_label: sentiment.label,
      is_flagged: sentiment.isFlagged,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error logging mood:', error);
    throw error;
  }

  // Escalation Check: Check if last 3 entries are negative or flagged
  try {
    const { data: recentLogs, error: recentError } = await supabase
      .from('mood_logs')
      .select('sentiment_label, is_flagged')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!recentError && recentLogs && recentLogs.length === 3) {
      const allNegativeOrFlagged = recentLogs.every(
        (log) => log.sentiment_label === 'negative' || log.is_flagged === true
      );

      if (allNegativeOrFlagged) {
        // Fetch assigned counselor (last accepted appointment)
        const { data: appt } = await supabase
          .from('appointments')
          .select('counselor_id')
          .eq('student_id', studentId)
          .eq('status', 'accepted')
          .order('appointment_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Also fetch student profile details to get their full name
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', studentId)
          .maybeSingle();

        const studentName = profile?.name || 'A student member';
        const assignedCounselorId = appt?.counselor_id || 'kwame-boateng';

        // Send alert notification referencing the counselor
        await supabase.from('notifications').insert({
          title: '🚨 High-Priority Escalation Alert',
          body: `Mental check-in warnings: Student ${studentName} has logged negative/flagged mood sentiment for 3 consecutive days. Proactive clinical outreach is recommended.`,
          user_id: assignedCounselorId,
        });
      }
    }
  } catch (escErr) {
    console.warn('Escalation logic exception:', escErr);
  }

  return data;
}

export async function fetchMoodLogs(studentId: string): Promise<SupabaseMoodLog[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from('mood_logs')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching mood logs:', error);
    throw error;
  }
  return data || [];
}

// ------------------------------
// SOCIAL COMMUNITY FEED
// ------------------------------
export interface SupabasePost {
  id: string;
  user_id: string;
  content: string;
  media_url?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  profiles?: {
    name: string;
    role: string;
    avatar_url: string | null;
  };
  has_liked?: boolean;
  moderation_status?: 'approved' | 'flagged' | 'blocked';
  is_flagged?: boolean;
  flag_reason?: string;
}

export interface SupabaseLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface SupabaseComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    name: string;
    role: string;
    avatar_url: string | null;
  };
}

export async function fetchPosts(currentUserId?: string): Promise<SupabasePost[]> {
  if (!hasSupabaseConfig || !supabase) {
    // Sandbox offline fallback data
    return [
      {
        id: 'mock-post-1',
        user_id: 'amina-owusu',
        content: 'Take a deep breath. Exam season is near, but your worth is not defined by grades. 💙',
        likes_count: 5,
        comments_count: 1,
        shares_count: 1,
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        profiles: { name: 'Amina Owusu', role: 'counselor', avatar_url: null },
        has_liked: false,
      },
      {
        id: 'mock-post-2',
        user_id: 'kwame-boateng',
        content: 'Burnout is real. Plan 15-minute breaks for every 90 minutes of studying. Your mind will thank you!',
        likes_count: 12,
        comments_count: 0,
        shares_count: 3,
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        profiles: { name: 'Kwame Boateng', role: 'counselor', avatar_url: null },
        has_liked: true,
      }
    ];
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (name, role, avatar_url)
    `)
    .neq('moderation_status', 'blocked')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }

  const posts = (data || []) as SupabasePost[];

  // If logged in, fetch current user's liked posts to determine has_liked state
  if (currentUserId && posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const { data: likedData, error: likesError } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in('post_id', postIds);

    if (!likesError && likedData) {
      const likedSet = new Set(likedData.map(l => l.post_id));
      posts.forEach(post => {
        post.has_liked = likedSet.has(post.id);
      });
    }
  }

  return posts;
}

export async function fetchPostDetail(postId: string, currentUserId?: string): Promise<SupabasePost | null> {
  if (!hasSupabaseConfig || !supabase) {
    const mockPosts = await fetchPosts(currentUserId);
    return mockPosts.find(p => p.id === postId) || null;
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (name, role, avatar_url)
    `)
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching post detail:', error);
    throw error;
  }

  if (!data) return null;
  const post = data as unknown as SupabasePost;

  if (currentUserId) {
    const { data: likedData, error: likesError } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .eq('post_id', postId)
      .maybeSingle();

    post.has_liked = !likesError && !!likedData;
  }

  return post;
}

export async function createPost(
  userId: string,
  content: string,
  mediaUrl?: string | null,
  moderationResult?: { status: 'approved' | 'flagged' | 'blocked'; isFlagged: boolean; reason?: string | null }
): Promise<SupabasePost | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  // Run ML moderation analyzer if not pre-moderated (HF API → keyword fallback)
  const mod = moderationResult || await moderateContent(content);

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      media_url: mediaUrl,
      moderation_status: mod.status,
      is_flagged: mod.isFlagged,
      flag_reason: mod.reason || null,
    })
    .select(`
      *,
      profiles:user_id (name, role, avatar_url)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error creating post:', error);
    throw error;
  }
  return data;
}

export async function deletePost(postId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return true;

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
  return true;
}

export async function toggleLikePost(postId: string, userId: string): Promise<{ liked: boolean; count: number }> {
  if (!hasSupabaseConfig || !supabase) return { liked: true, count: 1 };

  // Check if like exists
  const { data: existingLike, error: checkError } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (checkError) throw checkError;

  let isLiked = false;

  if (existingLike) {
    // Unlike
    const { error: unlikeError } = await supabase
      .from('likes')
      .delete()
      .eq('id', existingLike.id);
      
    if (unlikeError) throw unlikeError;
    isLiked = false;
  } else {
    // Like
    const { error: likeError } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: userId });

    if (likeError) throw likeError;
    isLiked = true;
  }

  // Fetch updated likes count from likes table
  const { count: likesCount, error: countError } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (countError) throw countError;

  const finalCount = likesCount || 0;

  // Update posts table with new count
  await supabase
    .from('posts')
    .update({ likes_count: finalCount })
    .eq('id', postId);

  return { liked: isLiked, count: finalCount };
}

export async function fetchComments(postId: string): Promise<SupabaseComment[]> {
  if (!hasSupabaseConfig || !supabase) {
    return [
      {
        id: 'mock-c-1',
        post_id: postId,
        user_id: 'student-id',
        content: 'Thank you for this advice!',
        created_at: new Date(Date.now() - 600000).toISOString(),
        profiles: { name: 'Adjoa D.', role: 'student', avatar_url: null }
      }
    ];
  }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      profiles:user_id (name, role, avatar_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
  return (data || []) as SupabaseComment[];
}

export async function createComment(postId: string, userId: string, content: string): Promise<SupabaseComment | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, content })
    .select(`
      *,
      profiles:user_id (name, role, avatar_url)
    `)
    .maybeSingle();

  if (error) {
    console.error('Error creating comment:', error);
    throw error;
  }

  // Update comments count on the post
  const { count: commentsCount, error: countError } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (!countError && commentsCount !== null) {
    await supabase
      .from('posts')
      .update({ comments_count: commentsCount })
      .eq('id', postId);
  }

  return data;
}

export async function incrementShareCount(postId: string): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 1;

  // Read current shares count
  const { data, error } = await supabase
    .from('posts')
    .select('shares_count')
    .eq('id', postId)
    .maybeSingle();

  if (error) throw error;

  const newSharesCount = (data?.shares_count || 0) + 1;

  await supabase
    .from('posts')
    .update({ shares_count: newSharesCount })
    .eq('id', postId);

  return newSharesCount;
}

// ═══════════════════════════════════════════════
// 12. Calls (video/voice call invites + state)
// ═══════════════════════════════════════════════

export interface SupabaseCall {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'missed' | 'ended';
  room_id: string;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  caller_profile?: SupabaseProfile;
  callee_profile?: SupabaseProfile;
}

export async function createCall(
  callerId: string,
  calleeId: string,
  callType: 'voice' | 'video',
  roomId: string,
): Promise<SupabaseCall | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('calls')
    .insert({
      caller_id: callerId,
      callee_id: calleeId,
      call_type: callType,
      room_id: roomId,
      status: 'ringing',
    })
    .select()
    .single();
  if (error) {
    console.warn('[DB] createCall error:', error.message);
    return null;
  }
  return data as unknown as SupabaseCall;
}

export async function updateCallStatus(
  callId: string,
  status: SupabaseCall['status'],
): Promise<boolean> {
  if (!supabase) return false;
  const update: Record<string, unknown> = { status };
  if (status === 'accepted') update.answered_at = new Date().toISOString();
  if (status === 'ended' || status === 'missed' || status === 'declined') update.ended_at = new Date().toISOString();
  const { error } = await supabase
    .from('calls')
    .update(update)
    .eq('id', callId);
  if (error) {
    console.warn('[DB] updateCallStatus error:', error.message);
    return false;
  }
  return true;
}

export async function fetchCallById(callId: string): Promise<SupabaseCall | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single();
  if (error || !data) return null;
  return data as unknown as SupabaseCall;
}

/**
 * Subscribe to status changes on a specific call.
 * Returns the unsubscribe function.
 */
export function subscribeToCallStatus(
  callId: string,
  onUpdate: (call: SupabaseCall) => void,
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`call-${callId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
      (payload) => {
        onUpdate(payload.new as unknown as SupabaseCall);
      },
    )
    .subscribe();
  return () => {
    supabase!.removeChannel(channel);
  };
}

/**
 * Subscribe to incoming calls for a specific user (callee).
 * Fires when a new row is inserted where callee_id matches.
 * Returns the unsubscribe function.
 */
export function subscribeToIncomingCalls(
  calleeId: string,
  onIncoming: (call: SupabaseCall) => void,
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`incoming-calls-${calleeId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${calleeId}` },
      (payload) => {
        onIncoming(payload.new as unknown as SupabaseCall);
      },
    )
    .subscribe();
  return () => {
    supabase!.removeChannel(channel);
  };
}
