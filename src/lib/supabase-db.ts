import { supabase, hasSupabaseConfig } from './supabase';
import { analyzeSentiment, moderateContent } from './sentiment';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SupabaseProfile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'counselor' | 'admin';
  avatar_url?: string;
  anonymous_id?: string;
  created_at: string;
}

export interface SupabaseStudentProfile {
  user_id: string;
  student_index_number?: string;
  program?: string;
  year_of_study?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at?: string;
}

export interface SupabaseCounselorProfile {
  user_id: string;
  license_number: string;
  qualification: string;
  credential_document_url?: string;
  specializations: string[];
  bio: string;
  photo_url?: string;
  availability?: { day: string; start: string; end: string }[];
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
  profile?: SupabaseProfile;
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
  is_anonymous_display: boolean;
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
// PROFILES & ANONYMOUS IDENTITIES
// ------------------------------
export function generateAnonymousId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'KNUST-ANON-';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function upsertProfile(
  id: string,
  name: string,
  email: string,
  role: 'student' | 'counselor' | 'admin',
  avatarUrl?: string,
  anonymousId?: string
): Promise<SupabaseProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  
  const payload: Record<string, any> = { id, name, email, role };
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;
  if (anonymousId !== undefined) payload.anonymous_id = anonymousId;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Profiles] RLS or DB notice during upsert:', error.message || error);
      return { id, name, email, role, avatar_url: avatarUrl, anonymous_id: anonymousId, created_at: new Date().toISOString() };
    }
    return data;
  } catch (err) {
    console.warn('[Supabase Profiles] Catching upsert error, falling back locally:', err);
    return { id, name, email, role, avatar_url: avatarUrl, anonymous_id: anonymousId, created_at: new Date().toISOString() };
  }
}

// ------------------------------
// STUDENT PROFILES
// ------------------------------
export async function createStudentProfile(data: {
  userId: string;
  studentIndexNumber?: string;
  program?: string;
  yearOfStudy?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}): Promise<SupabaseStudentProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const payload: SupabaseStudentProfile = {
    user_id: data.userId,
    student_index_number: data.studentIndexNumber || undefined,
    program: data.program || undefined,
    year_of_study: data.yearOfStudy || undefined,
    emergency_contact_name: data.emergencyContactName || undefined,
    emergency_contact_phone: data.emergencyContactPhone || undefined,
    created_at: new Date().toISOString(),
  };

  try {
    const { data: result, error } = await supabase
      .from('student_profiles')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Student Profile] RLS notice (code 42501). Falling back gracefully:', error.message);
      return payload;
    }
    return result;
  } catch (err) {
    console.warn('[Supabase Student Profile] Error creating student profile, using fallback:', err);
    return payload;
  }
}

export async function fetchStudentProfile(userId: string): Promise<SupabaseStudentProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching student profile:', error);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// ------------------------------
// COUNSELOR PROFILES & APPROVALS
// ------------------------------
export async function createCounselorProfile(data: {
  userId: string;
  licenseNumber: string;
  qualification: string;
  credentialDocumentUrl?: string;
  specializations: string[];
  bio: string;
  photoUrl?: string;
  availability?: { day: string; start: string; end: string }[];
}): Promise<SupabaseCounselorProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const payload: SupabaseCounselorProfile = {
    user_id: data.userId,
    license_number: data.licenseNumber,
    qualification: data.qualification,
    credential_document_url: data.credentialDocumentUrl || undefined,
    specializations: data.specializations || [],
    bio: data.bio || '',
    photo_url: data.photoUrl || undefined,
    availability: data.availability || [],
    approval_status: 'pending',
    created_at: new Date().toISOString(),
  };

  try {
    const { data: result, error } = await supabase
      .from('counselor_profiles')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Counselor Profile] RLS notice (code 42501). Falling back gracefully:', error.message);
    }

    // Also initialize counselors metadata record for compatibility
    await createCounselorMetadata(data.userId, data.specializations, 'Application Pending Review', data.bio);

    return result || payload;
  } catch (err) {
    console.warn('[Supabase Counselor Profile] Catch error, using fallback:', err);
    await createCounselorMetadata(data.userId, data.specializations, 'Application Pending Review', data.bio);
    return payload;
  }
}

export async function fetchCounselorProfile(userId: string): Promise<SupabaseCounselorProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('counselor_profiles')
    .select(`
      *,
      profile:profiles!user_id (id, name, email, role, avatar_url)
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching counselor profile:', error);
    return null;
  }
  return data as unknown as SupabaseCounselorProfile;
}

export async function fetchPendingCounselors(): Promise<SupabaseCounselorProfile[]> {
  return fetchCounselorProfilesByStatus('pending');
}

export async function fetchCounselorProfilesByStatus(
  status: 'pending' | 'approved' | 'rejected'
): Promise<SupabaseCounselorProfile[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const isAscending = status === 'pending'; // Oldest first for pending queue
  const { data, error } = await supabase
    .from('counselor_profiles')
    .select(`
      *,
      profile:profiles!user_id (id, name, email, role, avatar_url)
    `)
    .eq('approval_status', status)
    .order('created_at', { ascending: isAscending });

  if (error) {
    console.error(`Error fetching ${status} counselors:`, error);
    return [];
  }
  return (data || []) as unknown as SupabaseCounselorProfile[];
}

export async function fetchPendingCounselorsCount(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;

  try {
    const { count, error } = await supabase
      .from('counselor_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'pending');

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function updateCounselorApprovalStatus(
  counselorId: string,
  status: 'approved' | 'rejected',
  rejectionReason?: string,
  adminId?: string
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const update: Record<string, any> = {
    approval_status: status,
    reviewed_at: new Date().toISOString(),
  };
  if (rejectionReason) update.rejection_reason = rejectionReason;
  if (adminId) update.reviewed_by = adminId;

  const { error } = await supabase
    .from('counselor_profiles')
    .update(update)
    .eq('user_id', counselorId);

  if (error) {
    console.error('Error updating counselor approval status:', error);
    return false;
  }

  return true;
}

// ------------------------------
// COUNSELORS (STUDENT-FACING LIST - APPROVED ONLY)
// ------------------------------
export async function fetchCounselors(): Promise<SupabaseCounselor[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  // 1. Fetch unapproved counselor user_ids to filter out pending/rejected applicants
  let unapprovedIds = new Set<string>();
  try {
    const { data: unapprovedProfiles } = await supabase
      .from('counselor_profiles')
      .select('user_id')
      .neq('approval_status', 'approved');

    if (unapprovedProfiles) {
      unapprovedIds = new Set(unapprovedProfiles.map(p => p.user_id));
    }
  } catch {
    // If counselor_profiles table doesn't exist yet, proceed with default list
  }

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
    return (counselorData || []).filter(c => !unapprovedIds.has(c.id)) as unknown as SupabaseCounselor[];
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

  // Filter out any counselor whose approval_status is NOT approved
  return list.filter(c => !unapprovedIds.has(c.id));
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
async function getLocalAppointments(userId: string): Promise<SupabaseAppointment[]> {
  try {
    const raw = await AsyncStorage.getItem(`local_appts_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalAppointment(appt: SupabaseAppointment): Promise<void> {
  try {
    const existing = await getLocalAppointments(appt.student_id);
    const updated = [...existing, appt];
    await AsyncStorage.setItem(`local_appts_${appt.student_id}`, JSON.stringify(updated));
    if (appt.counselor_id !== appt.student_id) {
      const cExisting = await getLocalAppointments(appt.counselor_id);
      await AsyncStorage.setItem(`local_appts_${appt.counselor_id}`, JSON.stringify([...cExisting, appt]));
    }
  } catch {
    // Ignore write error
  }
}

export async function fetchAppointments(
  userId: string,
  role: 'student' | 'counselor'
): Promise<SupabaseAppointment[]> {
  const localAppts = await getLocalAppointments(userId);
  if (!hasSupabaseConfig || !supabase) return localAppts;

  const field = role === 'student' ? 'student_id' : 'counselor_id';
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, student_id, counselor_id, appointment_date, time_slot, status, topic,
        student_profile:profiles!appointments_student_id_fkey(id, name, email, avatar_url),
        counselor_profile:profiles!appointments_counselor_id_fkey(id, name, email, avatar_url)
      `)
      .eq(field, userId)
      .order('appointment_date', { ascending: true });

    if (error || !data) {
      console.warn('[Supabase Appointments] Error fetching appointments:', error?.message);
      return localAppts;
    }

    const remote = (data || []) as unknown as SupabaseAppointment[];
    const combined = [...remote];
    for (const la of localAppts) {
      if (!combined.some((a) => a.id === la.id)) {
        combined.push(la);
      }
    }
    return combined;
  } catch {
    return localAppts;
  }
}

export async function createAppointment(
  studentId: string,
  counselorId: string,
  date: string,
  timeSlot: string,
  topic: string,
  isAnonymousDisplay: boolean = false
): Promise<SupabaseAppointment | null> {
  const fallbackAppt: SupabaseAppointment = {
    id: generateFallbackUUID(),
    student_id: studentId,
    counselor_id: counselorId,
    appointment_date: date,
    time_slot: timeSlot,
    topic,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  if (!hasSupabaseConfig || !supabase) {
    await saveLocalAppointment(fallbackAppt);
    return fallbackAppt;
  }

  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        student_id: studentId,
        counselor_id: counselorId,
        appointment_date: date,
        time_slot: timeSlot,
        topic,
        is_anonymous_display: isAnonymousDisplay,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Appointments] Notice creating appointment (code ' + error.code + '):', error.message);
      await saveLocalAppointment(fallbackAppt);
      return fallbackAppt;
    }
    return data || fallbackAppt;
  } catch (err) {
    console.warn('[Supabase Appointments] Error creating appointment, using fallback:', err);
    await saveLocalAppointment(fallbackAppt);
    return fallbackAppt;
  }
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

  // Notify the student about the status change (fire-and-forget)
  notifyAppointmentUpdate(appointmentId, status).catch(() => {});

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

// Helper: Validate UUID syntax to prevent Postgres 22P02 error
export function isValidUUID(uuidStr: string): boolean {
  if (!uuidStr) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuidStr);
}

// Helper: Generate fallback valid UUID
export function generateFallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchOrCreateChat(studentId: string, counselorId: string): Promise<SupabaseChat | null> {
  if (!hasSupabaseConfig || !supabase) {
    return {
      id: generateFallbackUUID(),
      student_id: studentId,
      counselor_id: counselorId,
      last_message: 'Chat initialized.',
      last_message_at: new Date().toISOString(),
    };
  }

  try {
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

    if (!fetchError && existing) {
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
      console.warn('[Supabase Chats] Notice creating chat (code ' + createError.code + '):', createError.message);
      return {
        id: generateFallbackUUID(),
        student_id: studentId,
        counselor_id: counselorId,
        last_message: '',
        last_message_at: new Date().toISOString(),
      };
    }
    return created as unknown as SupabaseChat;
  } catch (err) {
    console.warn('[Supabase Chats] Error fetching or creating chat, returning valid fallback:', err);
    return {
      id: generateFallbackUUID(),
      student_id: studentId,
      counselor_id: counselorId,
      last_message: '',
      last_message_at: new Date().toISOString(),
    };
  }
}

async function getLocalFallbackMessages(chatId: string): Promise<SupabaseMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`local_msgs_${chatId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalFallbackMessage(msg: SupabaseMessage): Promise<void> {
  try {
    const existing = await getLocalFallbackMessages(msg.chat_id);
    const updated = [...existing, msg];
    await AsyncStorage.setItem(`local_msgs_${msg.chat_id}`, JSON.stringify(updated));
  } catch {
    // Ignore storage write error
  }
}

export async function fetchMessages(chatId: string): Promise<SupabaseMessage[]> {
  const localMsgs = await getLocalFallbackMessages(chatId);
  if (!hasSupabaseConfig || !supabase || !isValidUUID(chatId)) {
    return localMsgs;
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('[Supabase Messages] Error fetching messages:', error?.message);
      return localMsgs;
    }

    // Combine remote and local fallback messages deduplicated by id
    const combined = [...data];
    for (const lm of localMsgs) {
      if (!combined.some((m) => m.id === lm.id)) {
        combined.push(lm);
      }
    }
    combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return combined;
  } catch {
    return localMsgs;
  }
}

export async function sendMessage(chatId: string, senderId: string, text: string): Promise<SupabaseMessage | null> {
  const now = new Date().toISOString();
  const fallbackMessage: SupabaseMessage = {
    id: generateFallbackUUID(),
    chat_id: chatId,
    sender_id: senderId,
    text,
    created_at: now,
    delivered_at: now,
  };

  if (!hasSupabaseConfig || !supabase || !isValidUUID(chatId)) {
    await saveLocalFallbackMessage(fallbackMessage);
    return fallbackMessage;
  }

  try {
    // Insert individual message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        text,
        delivered_at: now,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Messages] Error inserting message:', error.message);
      await saveLocalFallbackMessage(fallbackMessage);
      return fallbackMessage;
    }

    // Update chat metadata block
    await supabase
      .from('chats')
      .update({ last_message: text, last_message_at: now })
      .eq('id', chatId);

    // Create notification for recipient (fire-and-forget)
    notifyNewMessage(chatId, senderId, 'Someone', text).catch(() => {});

    return data || fallbackMessage;
  } catch (err) {
    console.warn('[Supabase Messages] Exception sending message:', err);
    await saveLocalFallbackMessage(fallbackMessage);
    return fallbackMessage;
  }
}

export async function markMessagesAsRead(chatId: string, userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase || !isValidUUID(chatId)) return;

  try {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .neq('sender_id', userId)
      .is('read_at', null);

    if (error) {
      console.warn('[Supabase Messages] Error marking messages as read:', error.message);
    }
  } catch {
    // Ignore read mark error
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
// NOTIFICATIONS
// ------------------------------

/** Insert a user-targeted notification. Pass null userId for broadcast announcements. */
export async function createNotification(
  userId: string | null,
  title: string,
  body: string
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase.from('notifications').insert({
    title,
    body,
    user_id: userId,
  });

  if (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Insert a notification for the recipient when a new message is sent.
 * Looks up the chat to find the recipient, then creates a notification.
 */
export async function notifyNewMessage(
  chatId: string,
  senderId: string,
  _senderName: string,
  text: string
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    // Look up chat to find recipient
    const { data: chat } = await supabase
      .from('chats')
      .select('student_id, counselor_id')
      .eq('id', chatId)
      .maybeSingle();

    if (!chat) return;

    const recipientId = chat.student_id === senderId ? chat.counselor_id : chat.student_id;

    // Fetch sender's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', senderId)
      .maybeSingle();

    const senderName = profile?.name || 'Someone';
    const preview = text.length > 80 ? text.slice(0, 80) + '...' : text;

    await createNotification(
      recipientId,
      `New message from ${senderName}`,
      preview
    );
  } catch (err) {
    console.warn('Failed to create message notification:', err);
  }
}

/**
 * Insert a notification when an appointment status changes.
 * Notifies the student when accepted/declined/completed.
 */
export async function notifyAppointmentUpdate(
  appointmentId: string,
  status: 'accepted' | 'declined' | 'completed'
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select('student_id, counselor_id, topic, appointment_date, time_slot')
      .eq('id', appointmentId)
      .maybeSingle();

    if (!appt) return;

    // Always notify the student
    const recipientId = appt.student_id;
    const topic = appt.topic || 'Counseling session';
    const dateStr = new Date(appt.appointment_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    let title = '';
    let body = '';

    switch (status) {
      case 'accepted':
        title = 'Session Accepted';
        body = `Your ${topic} session on ${dateStr} at ${appt.time_slot} has been accepted.`;
        break;
      case 'declined':
        title = 'Session Declined';
        body = `Your ${topic} session on ${dateStr} at ${appt.time_slot} was declined. You can book a new session.`;
        break;
      case 'completed':
        title = 'Session Completed';
        body = `Your ${topic} session on ${dateStr} has been marked as completed. Check your progress!`;
        break;
    }

    await createNotification(recipientId, title, body);
  } catch (err) {
    console.warn('Failed to create appointment notification:', err);
  }
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
  is_anonymous: boolean;
  profiles?: {
    name: string;
    role: string;
    avatar_url: string | null;
    anonymous_id?: string;
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
  is_anonymous: boolean;
  profiles?: {
    name: string;
    role: string;
    avatar_url: string | null;
    anonymous_id?: string;
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
        is_anonymous: false,
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
        is_anonymous: false,
        profiles: { name: 'Kwame Boateng', role: 'counselor', avatar_url: null },
        has_liked: true,
      }
    ];
  }

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id (name, role, avatar_url, anonymous_id)
    `)
    .neq('moderation_status', 'blocked')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }

  const posts = (data || []) as SupabasePost[];

  // Enforce anonymity at data layer: strip name from anonymous posts for non-owning students
  posts.forEach((post) => {
    if (post.is_anonymous && post.user_id !== currentUserId && post.profiles) {
      post.profiles = { ...post.profiles, name: '' };
    }
  });

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
      profiles:user_id (name, role, avatar_url, anonymous_id)
    `)
    .eq('id', postId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching post detail:', error);
    throw error;
  }

  if (!data) return null;
  const post = data as unknown as SupabasePost;

  // Enforce anonymity at data layer
  if (post.is_anonymous && post.user_id !== currentUserId && post.profiles) {
    post.profiles = { ...post.profiles, name: '' };
  }

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
  moderationResult?: { status: 'approved' | 'flagged' | 'blocked'; isFlagged: boolean; reason?: string | null },
  isAnonymous: boolean = false
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
      is_anonymous: isAnonymous,
      moderation_status: mod.status,
      is_flagged: mod.isFlagged,
      flag_reason: mod.reason || null,
    })
    .select(`
      *,
      profiles:user_id (name, role, avatar_url, anonymous_id)
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
        is_anonymous: false,
        profiles: { name: 'Adjoa D.', role: 'student', avatar_url: null }
      }
    ];
  }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      profiles:user_id (name, role, avatar_url, anonymous_id)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }

  const comments = (data || []) as SupabaseComment[];

  // Enforce anonymity at data layer: strip name from anonymous comments for non-owning students
  comments.forEach((comment) => {
    if (comment.is_anonymous && comment.profiles) {
      comment.profiles = { ...comment.profiles, name: '' };
    }
  });

  return comments;
}

export async function createComment(postId: string, userId: string, content: string, isAnonymous: boolean = false): Promise<SupabaseComment | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, content, is_anonymous: isAnonymous })
    .select(`
      *,
      profiles:user_id (name, role, avatar_url, anonymous_id)
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
  is_anonymous_display?: boolean;
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
    .select(`
      *,
      caller_profile:profiles!calls_caller_id_fkey(id, name, email, avatar_url, anonymous_id)
    `)
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
    .select(`
      *,
      caller_profile:profiles!calls_caller_id_fkey(id, name, email, avatar_url, anonymous_id)
    `)
    .eq('id', callId)
    .single();
  if (error || !data) return null;
  return data as unknown as SupabaseCall;
}

export async function fetchProfileById(userId: string): Promise<SupabaseProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, avatar_url, anonymous_id, created_at')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as unknown as SupabaseProfile;
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
