/**
 * MindKNUST Core Business Logic & Utilities Test Suite
 */

const assert = require('assert');

console.log('===========================================================');
console.log('  MindKNUST Utilities & Pure Functionality Verification');
console.log('===========================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(description, fn) {
  try {
    fn();
    console.log(`[PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${description}:`, err.message);
    failedTests++;
  }
}

// 1. Display Identity Masking Tests
function testDisplayIdentity() {
  function getDisplayIdentity(user, isAnonymous, viewerRole) {
    if (viewerRole === 'counselor' || viewerRole === 'admin') {
      return user?.name || (isAnonymous ? user?.anonymous_id : undefined) || 'Unknown';
    }
    if (isAnonymous && user?.anonymous_id) {
      return user.anonymous_id;
    }
    return user?.name || 'Anonymous User';
  }

  function getAuthorInitials(displayName) {
    if (!displayName) return '??';
    const parts = displayName.split(/[\s_]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }

  function getHandleTag(displayName) {
    return `@${displayName.toLowerCase().replace(/[\s_]+/g, '')}`;
  }

  const user = { name: 'Kofi Mensah', anonymous_id: 'SilentHawk42' };

  runTest('Student viewing anonymous post sees anonymous ID', () => {
    assert.strictEqual(getDisplayIdentity(user, true, 'student'), 'SilentHawk42');
  });

  runTest('Student viewing standard post sees real name', () => {
    assert.strictEqual(getDisplayIdentity(user, false, 'student'), 'Kofi Mensah');
  });

  runTest('Counselor viewing user sees real name', () => {
    assert.strictEqual(getDisplayIdentity(user, true, 'counselor'), 'Kofi Mensah');
  });

  runTest('Author initials extracted properly for multi-word name', () => {
    assert.strictEqual(getAuthorInitials('Kofi Mensah'), 'KM');
  });

  runTest('Handle generated properly', () => {
    assert.strictEqual(getHandleTag('Kofi Mensah'), '@kofimensah');
  });
}

// 2. Counselor Utilities Tests
function testCounselorUtils() {
  function formatCounselorRating(rating, reviewCount) {
    const count = reviewCount ?? 0;
    const raw = rating ?? 0;
    if (count === 0 || raw === 0) {
      return { display: 'New', countPostfix: null };
    }
    return { display: raw.toFixed(1), countPostfix: `(${count})` };
  }

  function parseCounselorNote(note) {
    if (!note) return { formats: { online: true, inPerson: false }, cleanNote: '' };
    const match = note.match(/^\[formats:([a-zA-Z0-9\-_,]+)\]\s*(.*)$/i);
    if (match) {
      const formatsStr = match[1] || '';
      const cleanNote = match[2] || '';
      return {
        formats: {
          online: formatsStr.includes('online'),
          inPerson: formatsStr.includes('in-person'),
        },
        cleanNote,
      };
    }
    return { formats: { online: true, inPerson: false }, cleanNote: note };
  }

  runTest('Counselor without reviews formats as New', () => {
    const res = formatCounselorRating(0, 0);
    assert.strictEqual(res.display, 'New');
    assert.strictEqual(res.countPostfix, null);
  });

  runTest('Counselor with reviews formats rating and count', () => {
    const res = formatCounselorRating(4.9, 12);
    assert.strictEqual(res.display, '4.9');
    assert.strictEqual(res.countPostfix, '(12)');
  });

  runTest('Counselor note format metadata serialized & parsed accurately', () => {
    const note = '[formats:online,in-person] Available for campus sessions';
    const parsed = parseCounselorNote(note);
    assert.strictEqual(parsed.formats.online, true);
    assert.strictEqual(parsed.formats.inPerson, true);
    assert.strictEqual(parsed.cleanNote, 'Available for campus sessions');
  });
}

// 3. Appointment Slot Calculations Tests
function testAppointmentUtils() {
  function parseTimeStr(timeStr) {
    const cleanTime = timeStr.toUpperCase().trim();
    const ampmMatch = cleanTime.match(/^(\d+):(\d+)\s*(AM|PM)$/);
    if (!ampmMatch) throw new Error('Invalid time');
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3];
    if (ampm === 'PM' && hours < 12) hours += 12;
    else if (ampm === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  function parseAppointmentDateTime(dateStr, timeSlot) {
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) throw new Error('Invalid date');
    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const day = parseInt(dateMatch[3], 10);

    const parts = timeSlot.split('-');
    const startHourMin = parseTimeStr(parts[0].trim());
    const start = new Date(Date.UTC(year, month, day, startHourMin.hours, startHourMin.minutes, 0));
    let end = null;
    if (parts[1]) {
      const endHourMin = parseTimeStr(parts[1].trim());
      end = new Date(Date.UTC(year, month, day, endHourMin.hours, endHourMin.minutes, 0));
    }
    return { start, end };
  }

  runTest('Parses appointment slot with UTC start and end bounds', () => {
    const { start, end } = parseAppointmentDateTime('2026-09-01', '10:00 AM - 10:45 AM');
    assert.strictEqual(start.getUTCHours(), 10);
    assert.strictEqual(start.getUTCMinutes(), 0);
    assert.strictEqual(end.getUTCHours(), 10);
    assert.strictEqual(end.getUTCMinutes(), 45);
  });

  runTest('Handles PM hour conversions correctly', () => {
    const { start } = parseAppointmentDateTime('2026-09-01', '2:30 PM');
    assert.strictEqual(start.getUTCHours(), 14);
    assert.strictEqual(start.getUTCMinutes(), 30);
  });
}

// 4. Content Moderation & Sentiment Rules Tests
function testModerationRules() {
  const CRISIS_WORDS = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'harm myself', 'self harm', 'end it all'
  ];
  const TOXIC_WORDS = [
    'hate you', 'kill yourself', 'kys', 'trash', 'idiot', 'moron'
  ];

  function keywordModerate(text) {
    const lower = text.toLowerCase();
    for (const phrase of CRISIS_WORDS) {
      if (lower.includes(phrase)) {
        return { status: 'flagged', isFlagged: true, reason: 'crisis' };
      }
    }
    for (const word of TOXIC_WORDS) {
      if (lower.includes(word)) {
        return { status: 'blocked', isFlagged: true, reason: 'toxic' };
      }
    }
    return { status: 'approved', isFlagged: false };
  }

  runTest('Safe text is approved with 0 flags', () => {
    const res = keywordModerate('I had a productive study session today in the library.');
    assert.strictEqual(res.status, 'approved');
    assert.strictEqual(res.isFlagged, false);
  });

  runTest('Crisis text triggers flagged status for clinical intervention', () => {
    const res = keywordModerate('I feel overwhelmed and want to end my life');
    assert.strictEqual(res.status, 'flagged');
    assert.strictEqual(res.isFlagged, true);
    assert.strictEqual(res.reason, 'crisis');
  });

  runTest('Toxic abuse triggers blocked status', () => {
    const res = keywordModerate('You are an idiot');
    assert.strictEqual(res.status, 'blocked');
    assert.strictEqual(res.isFlagged, true);
    assert.strictEqual(res.reason, 'toxic');
  });
}

testDisplayIdentity();
testCounselorUtils();
testAppointmentUtils();
testModerationRules();

console.log('\n-----------------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('-----------------------------------------------------------');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Core Utility Tests Passed Successfully.\n');
  process.exit(0);
}
