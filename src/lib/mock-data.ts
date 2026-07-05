export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface ChatThread {
  id: string;
  participantName: string;
  participantRole: string;
  participantInitials: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: Message[];
}

export interface BookingRequest {
  id: string;
  studentName: string;
  issue: string;
  slot: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface CounselorAgendaItem {
  id: string;
  studentName: string;
  time: string;
  topic: string;
  type: 'Online' | 'Hybrid';
}

// Student View mock data
export const studentChatsMock: ChatThread[] = [
  {
    id: 'amina-owusu',
    participantName: 'Amina Owusu',
    participantRole: 'Student counselor',
    participantInitials: 'AO',
    lastMessage: 'Let\'s review your exam stress plan at 4:30 today.',
    timestamp: '2:15 PM',
    unreadCount: 1,
    messages: [
      { id: '1', senderId: 'student', senderName: 'Adjoa D.', text: 'Hi Amina, I was wondering if we could focus on sleep scheduling today.', timestamp: '1:50 PM' },
      { id: '2', senderId: 'amina-owusu', senderName: 'Amina Owusu', text: 'Hi Adjoa! Yes, sleep is a key driver for focus.', timestamp: '2:10 PM' },
      { id: '3', senderId: 'amina-owusu', senderName: 'Amina Owusu', text: 'Let\'s review your exam stress plan at 4:30 today.', timestamp: '2:15 PM' },
    ],
  },
  {
    id: 'kwame-boateng',
    participantName: 'Kwame Boateng',
    participantRole: 'Wellbeing coach',
    participantInitials: 'KB',
    lastMessage: 'Good job keeping up your mood streak!',
    timestamp: 'Yesterday',
    unreadCount: 0,
    messages: [
      { id: '1', senderId: 'kwame-boateng', senderName: 'Kwame Boateng', text: 'How has the breathing exercise gone?', timestamp: 'Mon 3:00 PM' },
      { id: '2', senderId: 'student', senderName: 'Adjoa D.', text: 'Really well, it helps me calm down before exams.', timestamp: 'Mon 3:15 PM' },
      { id: '3', senderId: 'kwame-boateng', senderName: 'Kwame Boateng', text: 'Good job keeping up your mood streak!', timestamp: 'Mon 3:20 PM' },
    ],
  },
  {
    id: 'selina-badu',
    participantName: 'Selina Badu',
    participantRole: 'Anxiety specialist',
    participantInitials: 'SB',
    lastMessage: 'Let me know if you would like to book a slot for next week.',
    timestamp: '3 days ago',
    unreadCount: 0,
    messages: [
      { id: '1', senderId: 'selina-badu', senderName: 'Selina Badu', text: 'Let me know if you would like to book a slot for next week.', timestamp: 'Sunday' },
    ],
  },
];

// Counselor View mock data
export const counselorChatsMock: ChatThread[] = [
  {
    id: 'student-adjoa',
    participantName: 'Adjoa D.',
    participantRole: 'Student (Level 200)',
    participantInitials: 'AD',
    lastMessage: 'Hi Kwame, I checked my agenda and I am free this Friday.',
    timestamp: '1:30 PM',
    unreadCount: 2,
    messages: [
      { id: '1', senderId: 'kwame-boateng', senderName: 'Kwame Boateng', text: 'Hi Adjoa, would you like to review your growth goals?', timestamp: 'Yesterday' },
      { id: '2', senderId: 'student-adjoa', senderName: 'Adjoa D.', text: 'Yes, that would be helpful.', timestamp: '12:05 PM' },
      { id: '3', senderId: 'student-adjoa', senderName: 'Adjoa D.', text: 'Hi Kwame, I checked my agenda and I am free this Friday.', timestamp: '1:30 PM' },
    ],
  },
  {
    id: 'student-emmanuel',
    participantName: 'Emmanuel K.',
    participantRole: 'Student (Level 400)',
    participantInitials: 'EK',
    lastMessage: 'Thank you for the guidance on my senior project anxiety.',
    timestamp: 'Yesterday',
    unreadCount: 0,
    messages: [
      { id: '1', senderId: 'student-emmanuel', senderName: 'Emmanuel K.', text: 'Thank you for the guidance on my senior project anxiety.', timestamp: 'Yesterday' },
    ],
  },
  {
    id: 'student-sandrine',
    participantName: 'Sandrine N.',
    participantRole: 'Student (Level 100)',
    participantInitials: 'SN',
    lastMessage: 'Can we move our intake slot to next week?',
    timestamp: '2 days ago',
    unreadCount: 0,
    messages: [
      { id: '1', senderId: 'student-sandrine', senderName: 'Sandrine N.', text: 'Can we move our intake slot to next week?', timestamp: '2 days ago' },
    ],
  },
];

export const initialBookingRequests: BookingRequest[] = [
  { id: 'req-1', studentName: 'Emmanuel K.', issue: 'Severe exam panic', slot: 'Friday at 10:00 AM', status: 'pending' },
  { id: 'req-2', studentName: 'Sandrine N.', issue: 'Adjustment & roommate conflict', slot: 'Saturday at 1:00 PM', status: 'pending' },
];

export const counselorAgendaMock: CounselorAgendaItem[] = [
  { id: 'ag-1', studentName: 'Adjoa D.', time: '4:30 PM - 5:00 PM', topic: 'Exam anxiety review & sleep schedules', type: 'Online' },
  { id: 'ag-2', studentName: 'Ebenezer A.', time: '5:15 PM - 6:00 PM', topic: 'Career coaching & routines', type: 'Hybrid' },
];

export const counselorSlotsMock = ['9:00 AM', '10:30 AM', '1:00 PM', '3:00 PM', '4:30 PM'];
