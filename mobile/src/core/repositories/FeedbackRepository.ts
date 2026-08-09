/**
 * Feedback domain repository (master §12.2) — tickets, FAQ, contact directory.
 *
 * No dedicated feedback service exists yet: none of the docs under
 * `docs/Backend Documentation/` defines ticket routes. The system spec
 * (§5.12) fixes the FeedbackTicket shape (category[bug|feature|complaint|general],
 * severity, description, attachments[], status, created_at, response), so every
 * method below is a local mock behind the real repository surface — Phase 2
 * swaps the bodies for `apiClient` calls without touching hooks or screens.
 *
 * TODO(Phase 2): wire to the feedback-service once it ships:
 *   POST /feedback/tickets            → submit (rate-limited 3/hr, returns ticket)
 *   GET  /feedback/faqs               → listFaqs
 *   GET  /feedback/coordinators       → listCoordinators (active term)
 *   GET  /feedback/coordinators/legacy→ listLegacyAdmins
 */

export type FeedbackCategory = 'bug' | 'feature' | 'complaint' | 'general';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'submitted' | 'under_review' | 'resolved' | 'closed';

export interface FeedbackAttachment {
  uri: string;
  name: string;
  /** Bytes. Mock picker reports 0 when the OS omits fileSize. */
  size: number;
  mime: string;
}

export interface FeedbackInput {
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  description: string;
  attachments: FeedbackAttachment[];
  /** Guest submissions are always anonymous (spec §3.4). */
  anonymous: boolean;
  /** Required for guests; used by authed users only when submitting anonymously. */
  contactEmail?: string;
  /** Omitted when anonymous — server derives it from the JWT otherwise. */
  userId?: string;
}

export interface FeedbackTicket {
  id: string; // e.g. 'TICK-84920' (display as `#${id}`)
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  description: string;
  attachments: FeedbackAttachment[];
  anonymous: boolean;
  contactEmail?: string;
  status: TicketStatus;
  createdAt: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqSection {
  id: string;
  title: string;
  faqs: FaqItem[];
}

export interface Coordinator {
  id: string;
  name: string;
  role: string;
  email: string;
  /** Full E.164 number; the UI masks it until revealed (spec §5.2). */
  phone: string;
  tenure: string;
}

export interface LegacyAdmin {
  id: string;
  name: string;
  role: string;
  tenure: string;
  quote: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────

const FAQ_SECTIONS_MOCK: FaqSection[] = [
  {
    id: 'account',
    title: 'Account',
    faqs: [
      { id: 'acc-1', question: 'How do I reset my password?', answer: 'Use the "Forgot password" link on the login screen. A reset link is emailed to your registered BITS Goa address and expires in 15 minutes.' },
      { id: 'acc-2', question: 'How do I update my profile?', answer: 'Open Profile → Edit. Changes save instantly and sync to your account.' },
      { id: 'acc-3', question: 'Can I change my registered email?', answer: 'Email changes require identity verification. Contact a coordinator via the Contact tab and we will update it for you.' },
    ],
  },
  {
    id: 'events',
    title: 'Events',
    faqs: [
      { id: 'evt-1', question: 'How do I register for an event?', answer: 'Open the Events tab, pick a tournament and tap Register. Captain-led teams register with a team name; solo events confirm instantly.' },
      { id: 'evt-2', question: 'What are the bracket formats?', answer: 'Double elimination (DE) and league (LE) formats are used depending on the tournament. Bracket previews open once registration closes.' },
      { id: 'evt-3', question: 'When do registrations close?', answer: 'Typically 24 hours before the event start time. Deadlines are shown on each event card.' },
    ],
  },
  {
    id: 'points',
    title: 'Points',
    faqs: [
      { id: 'pts-1', question: 'How are points awarded?', answer: 'Points are credited directly to your wallet within 2 hours of admin score verification.' },
      { id: 'pts-2', question: 'What is the LE bonus?', answer: 'Playing in a League Event earns a 10-point participation bonus on top of placement points.' },
      { id: 'pts-3', question: 'How do I redeem points?', answer: 'Open the Store tab, add items to your cart and check out. Items are fulfilled within 7 working days.' },
    ],
  },
  {
    id: 'union',
    title: 'Student Union',
    faqs: [
      { id: 'uni-1', question: 'How do I contact the student union?', answer: 'Union queries are handled through the Contact tab — pick "Event Complaint" and mention the union in your description.' },
      { id: 'uni-2', question: 'When are union elections held?', answer: 'Annual elections are announced on the announcements feed at least two weeks in advance.' },
    ],
  },
  {
    id: 'technical',
    title: 'Technical & Performance',
    faqs: [
      { id: 'tec-1', question: 'The app keeps crashing — what do I do?', answer: 'Submit a bug ticket with your device model and a screenshot. Attachments up to 5MB help us reproduce the issue.' },
      { id: 'tec-2', question: 'Are my notifications delayed?', answer: 'Push notifications can lag behind in battery-saver mode. Keep the app in recent apps to receive instant updates.' },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Anonymity',
    faqs: [
      { id: 'prv-1', question: 'Is anonymous feedback really anonymous?', answer: 'Yes. Anonymous tickets strip your user ID from the payload — only your contact email (if provided) is stored.' },
      { id: 'prv-2', question: 'Who can see my profile?', answer: 'Your profile is visible to logged-in campus users only. Contact details stay hidden until you share them.' },
    ],
  },
  {
    id: 'sponsors',
    title: 'Sponsors & Perks',
    faqs: [
      { id: 'spo-1', question: 'How do sponsor challenges work?', answer: 'Sponsor challenges award bonus points for completing brand activities. They appear on the Points tab during the sponsor\u2019s tenure.' },
      { id: 'spo-2', question: 'How do I use a sponsor coupon?', answer: 'Coupons are emailed to affiliated users. Redeem them at the partner outlet before the listed expiry.' },
    ],
  },
];

const COORDINATORS_MOCK: Coordinator[] = [
  { id: 'c_rahul', name: 'Rahul Mehta', role: 'BGSC Coordinator', email: 'rahul.mehta@bgsc.in', phone: '+91 98765 43210', tenure: '2025–2026' },
  { id: 'c_ananya', name: 'Ananya Iyer', role: 'Esports Coordinator', email: 'ananya.iyer@bgsc.in', phone: '+91 91234 56780', tenure: '2025–2026' },
  { id: 'c_kabir', name: 'Kabir Desai', role: 'Events Coordinator', email: 'kabir.desai@bgsc.in', phone: '+91 99887 76655', tenure: '2025–2026' },
];

const LEGACY_ADMINS_MOCK: LegacyAdmin[] = [
  { id: 'l_aarav', name: 'Aarav Sharma', role: 'Founder & Head Coordinator', tenure: '2023–2024', quote: 'Built the league system from a spreadsheet and a dream.' },
  { id: 'l_meera', name: 'Meera Nair', role: 'Events Lead', tenure: '2023–2024', quote: 'Every bracket has a story. Ours started here.' },
  { id: 'l_vikram', name: 'Vikram Rao', role: 'Technical Lead', tenure: '2022–2023', quote: 'The scoreboard never sleeps.' },
  { id: 'l_ishita', name: 'Ishita Kulkarni', role: 'Community Lead', tenure: '2022–2023', quote: 'More than matches — we built a family.' },
];

// ── Mock rate limiter (spec §3.4: >3 tickets/hr → 429) ────────────────────
const MAX_TICKETS_PER_HOUR = 3;
const submittedAt: number[] = [];

export const FeedbackRepository = {
  /**
   * TODO(Phase 2): `apiClient.post<FeedbackTicket>('/feedback/tickets', { body: input })`.
   * Server enforces the 3/hr rate limit (HTTP 429) and auto-replies with the
   * ticket ID. The mock mirrors that: rejects with a readable message once the
   * limit is hit, otherwise returns a generated ticket after a short delay.
   */
  async submit(input: FeedbackInput): Promise<FeedbackTicket> {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = submittedAt.filter((t) => t > hourAgo);
    if (recent.length >= MAX_TICKETS_PER_HOUR) {
      throw new Error('Submission limit reached (3 tickets/hr). Please wait before trying again.');
    }
    await delay(800);
    submittedAt.push(Date.now());
    return {
      id: `TICK-${Math.floor(10000 + Math.random() * 89999)}`,
      category: input.category,
      severity: input.severity,
      description: input.description,
      attachments: input.attachments,
      anonymous: input.anonymous,
      contactEmail: input.contactEmail,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };
  },

  /** TODO(Phase 2): `apiClient.get<FaqSection[]>('/feedback/faqs')`. */
  async listFaqs(): Promise<FaqSection[]> {
    await delay(500);
    return FAQ_SECTIONS_MOCK;
  },

  /** TODO(Phase 2): `apiClient.get<Coordinator[]>('/feedback/coordinators')`. */
  async listCoordinators(): Promise<Coordinator[]> {
    await delay(500);
    return COORDINATORS_MOCK;
  },

  /** TODO(Phase 2): `apiClient.get<LegacyAdmin[]>('/feedback/coordinators/legacy')`. */
  async listLegacyAdmins(): Promise<LegacyAdmin[]> {
    await delay(400);
    return LEGACY_ADMINS_MOCK;
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
