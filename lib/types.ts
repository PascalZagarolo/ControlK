// ============ Existing: Channels & Messages ============
export type DealRadarInsight = {
  id: string;
  kind: 'mention' | 'stuck' | 'forecast' | 'momentum';
  title: string;
  detail: string;
  trend?: 'up' | 'down' | 'neutral';
  value?: string;
};

export type ConnectedChannel = {
  slug: string;
  name: string;
  reason: string;
};

export type ChannelMember = {
  name: string;
  initials: string;
  from: string;
  to: string;
  online?: boolean;
};

export type ChannelKind =
  | 'general'
  | 'customer'
  | 'deal'
  | 'damage'
  | 'onboarding'
  | 'announcement';

export type ChannelPinnedKind =
  | 'contract'
  | 'customer'
  | 'vehicle'
  | 'todo'
  | 'doc'
  | 'thread'
  | 'link';

export type ChannelDealStage =
  | 'lead'
  | 'angebot'
  | 'verhandlung'
  | 'gewonnen'
  | 'verloren'
  | 'onboarding'
  | 'aktiv';

export type ChannelPinnedItem = {
  id: string;
  kind: ChannelPinnedKind;
  label: string;
  targetId?: string;
  url?: string;
  position: number;
  pinnedAt: string;
};

export type ChannelHealth = {
  score: number;            // 0-100
  responseRate: number;     // 0-1
  medianFirstReplyMinutes?: number;
  staleThreadCount: number;
  spark: number[];          // 7-day message counts
};

export type ChannelLinkedDeal = {
  id: string;
  title: string;
  status: string;
  value: string;
};

export type ChannelLinkedCustomer = {
  id: string;
  slug: string;
  name: string;
  initials: string;
  from: string;
  to: string;
  status: string;
  healthScore?: number;
  mrcCents?: number;
};

export type Channel = {
  id?: string;
  slug: string;
  name: string;
  topic: string;
  kind?: ChannelKind;
  dealStage?: ChannelDealStage;
  members: number;
  unread: number;
  pinned: ChannelPinnedItem[];
  linkedDeals: ChannelLinkedDeal[];
  membersPreview: ChannelMember[];
  dealRadar: DealRadarInsight[];
  connectedChannels: ConnectedChannel[];
  linkedCustomer?: ChannelLinkedCustomer;
  health?: ChannelHealth;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  archived?: boolean;
};

export type ChannelSnippet = {
  id: string;
  slug: string;
  title: string;
  body: string;
  createdAt: string;
};

export type ChannelShareLinkRecord = {
  id: string;
  token: string;
  channelId: string;
  channelName: string;
  expiresAt?: string;
  onlyAnnouncements: boolean;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
};

export type ChannelEntityHit = {
  kind: 'customer' | 'contract' | 'vehicle' | 'todo';
  matchText: string;
  targetId: string;
  label: string;
  href: string;
};

export type Message = {
  id: string;
  /** Author user id — needed by the client to gate the edit/delete menu. */
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorFrom: string;
  authorTo: string;
  timestamp: string;
  body: string;
  /** Set when the message has been edited at least once. Triggers the
   *  "(bearbeitet)" hint next to the timestamp. */
  editedAt?: string;
  reactions?: { emoji: string; count: number }[];
  threadReplies?: Message[];
};

// ============ Customers ============
export type CustomerStatus = 'aktiv' | 'lead' | 'inaktiv';

export type CustomerActivity = {
  id: string;
  timestamp: string;
  kind: 'contract' | 'call' | 'email' | 'note' | 'meeting';
  title: string;
  detail?: string;
};

export type Customer = {
  id: string;
  name: string;
  industry: string;
  status: CustomerStatus;
  initials: string;
  from: string;
  to: string;
  contacts: { id?: string; name: string; role: string; email: string; phone?: string }[];
  activeContracts: number;
  totalValue: string;
  lastTouchpoint: string;
  linkedChannelSlugs: string[];
  pinnedDocs: { id: string; title: string }[];
  activity: CustomerActivity[];
  notes: string;
  forecastContribution?: string;
  // Enriched (Sprint 1-3)
  dbId?: string;
  owner?: TodoUser;
  tags?: CustomerTag[];
  health?: CustomerHealth;
  forecast?: CustomerForecast;
  fleetInUse?: FleetInUseItem[];
  contractTimeline?: ContractTimelineItem[];
  mergedActivity?: MergedActivityEntry[];
  renewalProbability?: number;
  quietDays?: number;
  damagePattern?: CustomerDamagePattern;
  onboardingProgress?: Record<string, boolean>;
  onboardingStartedAt?: string;
  mentions?: { channels: number; contracts: number; todos: number };
  channelHeatmap?: number[][]; // 7 days × 24 hours
};

export type CustomerTag = {
  id: string;
  slug: string;
  name: string;
  color?: string;
};

export type CustomerHealth = {
  score: number; // 0-100
  components: {
    activity: number;     // 0-40
    touchpoints: number;  // 0-25
    damages: number;      // 0-15
    forecast: number;     // 0-10
    onboarding: number;   // 0-10
  };
  spark: number[]; // 7-day daily activity score
};

export type CustomerForecast = {
  activeMrcCents: number;       // monthly recurring (sum of active contracts)
  atRiskCents: number;          // contracts auslaufend in 30d
  pipelineCents: number;        // leads × probability heuristic
};

export type FleetInUseItem = {
  vehicleId: string;
  plate: string;
  model: string;
  contractTitle?: string;
  startsAt?: string;
  endsAt?: string;
};

export type ContractTimelineItem = {
  id: string;
  title: string;
  status: ContractStatus;
  startsAt?: string;
  endsAt?: string;
  valueCents: number;
};

export type MergedActivityKind =
  | 'message'
  | 'contract_created'
  | 'contract_started'
  | 'contract_ended'
  | 'contract_storniert'
  | 'todo_completed'
  | 'todo_created'
  | 'calendar_event'
  | 'note'
  | 'system';

export type MergedActivityEntry = {
  id: string;
  kind: MergedActivityKind;
  title: string;
  detail?: string;
  occurredAt: string;
  actor?: { name: string; initials: string; from: string; to: string };
  link?: { href: string; label: string };
};

export type CustomerDamagePattern = {
  customerRate: number;   // damages per vehicle-month
  fleetAvg: number;
  deltaPercent: number;   // (customer - fleet) / fleet × 100
  totalDamages: number;
};

export type CustomerShareLink = {
  id: string;
  token: string;
  customerId: string;
  customerName: string;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
};

export const ONBOARDING_STEPS = [
  { key: 'contract_sent', label: 'Vertrag verschickt' },
  { key: 'handover_scheduled', label: 'Übergabe geplant' },
  { key: 'first_invoice', label: 'Erste Rechnung raus' },
  { key: 'feedback_call', label: 'Feedback-Call geführt' },
  { key: 'channel_setup', label: 'Channel eingerichtet' },
] as const;

// ============ Contracts ============
export type ContractStatus = 'aktiv' | 'auslaufend' | 'storniert' | 'entwurf' | 'vorlage';

export type Contract = {
  id: string;
  dbId?: string;
  title: string;
  customerId?: string;
  customerName?: string;
  customerDbId?: string;
  status: ContractStatus;
  templateOf?: string;
  value: string;
  valueCents?: number;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  createdBy: string;
  body: { heading: string; paragraphs: string[] }[];
  // Enriched (Sprint 1-3)
  owner?: TodoUser;
  vehicleId?: string;
  vehicleExternalId?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  acceptedAt?: string;
  acceptedByName?: string;
  acceptedByEmail?: string;
  discountPct?: number;
  estimatedCostsCents?: number;
  notes?: string;
  parentContractId?: string;
  renewalOfTitle?: string;
  daysToEnd?: number;
  daysActive?: number;
  margin?: ContractMargin;
  revisions?: ContractRevision[];
  signatures?: ContractSignatureRecord[];
};

export type ContractMargin = {
  valueCents: number;
  costsCents: number;
  discountPct: number;
  netCents: number;
  netPercent: number;
};

export type ContractRevision = {
  id: string;
  snapshotAt: string;
  snapshotBy?: TodoUser;
  title: string;
  valueCents?: number;
  note?: string;
  body: { heading: string; paragraphs: string[] }[];
};

export type ContractSignatureRecord = {
  id: string;
  signerName: string;
  signerEmail?: string;
  signerRole?: string;
  signedAt: string;
};

export type ContractShareLinkRecord = {
  id: string;
  token: string;
  contractId: string;
  contractTitle: string;
  allowSignature: boolean;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
};

export type ContractRevenueBucket = {
  label: string;
  monthIso: string;
  active: number;
  expiring: number;
  pipeline: number;
};

// ============ Fleet ============
export type VehicleStatus = 'frei' | 'vermietet' | 'wartung' | 'reserviert';
export type VehicleKind = 'sprinter' | 'transporter' | 'pkw' | 'kuehlfahrzeug';

export type Booking = {
  date: string; // ISO date (YYYY-MM-DD)
  status: 'frei' | 'vermietet' | 'wartung' | 'reserviert';
  label?: string;
};

export type Vehicle = {
  id: string;
  dbId?: string;
  plate: string;
  model: string;
  kind: VehicleKind;
  status: VehicleStatus;
  location: string;
  km: number;
  nextService: string;
  lastInspection: string;
  rating: number;
  damageHistory: VehicleDamageEntry[];
  frequentRenters: { customerId?: string; customerName: string; bookings: number }[];
  upcomingMaintenance: VehicleMaintenanceEntry[];
  bookings: Booking[];
  // Enriched (Sprint 1-3)
  owner?: TodoUser;
  tags?: VehicleTag[];
  utilization?: VehicleUtilization;
  income?: VehicleIncome;
  health?: VehicleHealth;
  conflicts?: VehicleBookingConflict[];
  damagePattern?: VehicleDamageStats;
  pricing?: VehiclePricing;
  notes?: string;
  serviceForecast?: ServiceForecast;
};

export type VehicleTag = {
  id: string;
  slug: string;
  name: string;
  color?: string;
};

export type VehicleDamageSeverity = 'minor' | 'major' | 'totalschaden';

export type VehicleDamageEntry = {
  id: string;
  date: string;
  severity: VehicleDamageSeverity;
  title: string;
  description?: string;
  photoUrl?: string;
  costCents?: number;
  customerId?: string;
  customerName?: string;
  contractId?: string;
  contractTitle?: string;
  resolved: boolean;
};

export type VehicleMaintenanceKind =
  | 'service'
  | 'inspection'
  | 'reifenwechsel'
  | 'cleaning'
  | 'other';

export type VehicleMaintenanceEntry = {
  id: string;
  kind: VehicleMaintenanceKind;
  title: string;
  intervalKm?: number;
  intervalDays?: number;
  lastDoneKm?: number;
  lastDoneAt?: string;
  nextDueAt?: string;
  overdue: boolean;
};

export type VehicleUtilization = {
  pct90d: number;            // 0-1
  pct30d: number;
  spark: number[];           // 7 daily 0/1 vermietet-ratio
  daily: ('frei' | 'vermietet' | 'wartung' | 'reserviert')[]; // 90 last days oldest→newest
};

export type VehicleIncome = {
  totalCents: number;        // last 12 months
  monthlyAverageCents: number;
  perDayCents: number;
  buckets: { label: string; cents: number }[]; // 12 months
  netMarginCents: number;    // total minus fixedCosts × 12
};

export type VehicleHealth = {
  score: number;             // 0-100
  components: {
    age: number;             // 0-20
    km: number;              // 0-20
    damages: number;         // 0-25
    inspection: number;      // 0-15
    rating: number;          // 0-10
    utilization: number;     // 0-10
  };
  spark: number[];
};

export type VehicleBookingConflict = {
  date: string;
  bookingA: { contractId?: string; contractTitle?: string; customerName?: string };
  bookingB: { contractId?: string; contractTitle?: string; customerName?: string };
};

export type VehicleDamageStats = {
  totalDamages: number;
  totalCostCents: number;
  ratePerYear: number;
  fleetAvgRate: number;
  deltaPercent: number;
  topOffenders: { customerName: string; count: number }[];
};

export type VehiclePricing = {
  dailyRateCents?: number;
  weekendSurchargeCents?: number;
  acquisitionCents?: number;
  monthlyFixedCostsCents?: number;
};

export type ServiceForecast = {
  daysToNext?: number;
  kmToNext?: number;
  status: 'fine' | 'soon' | 'overdue';
  reason?: string;
};

export type VehicleShareLink = {
  id: string;
  token: string;
  vehicleId?: string;
  vehicleLabel?: string;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
};

// ============ Calendar ============
export type CalendarEventKind =
  | 'meeting'
  | 'call'
  | 'focus'
  | 'task'
  | 'personal'
  | 'health'
  | 'travel'
  | 'other'
  | 'handover'
  | 'return'
  | 'maintenance'
  | 'internal';

export type CalendarChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startsAt: string;
  endsAt: string;
  detail?: string;
  location?: string;
  linkedContractId?: string;
  linkedCustomerId?: string;
  linkedCustomerName?: string;
  linkedCustomerInitials?: string;
  linkedCustomerFrom?: string;
  linkedCustomerTo?: string;
  linkedVehicleId?: string;
  linkedVehicleExternalId?: string;
  linkedVehiclePlate?: string;
  linkedVehicleModel?: string;
  linkedContractTitle?: string;
  checklist: CalendarChecklistItem[];
  recurringGroupId?: string;
  recurringRule?: string;
  reminderMinutes?: number;
  completedAt?: string;
  autoSpawnSource?: string;
  createdBy?: TodoUser;
};

export type CalendarConflict = {
  vehicleId: string;
  vehiclePlate: string;
  events: { id: string; title: string; startsAt: string; endsAt: string }[];
};

export type CalendarPreFlightAlert = {
  eventId: string;
  title: string;
  startsAt: string;
  minutesUntil: number;
  reason: 'checklist_incomplete' | 'vehicle_still_rented' | 'no_assignee';
  detail: string;
};

export type CalendarTemplate = {
  id: string;
  slug: string;
  name: string;
  kind: CalendarEventKind;
  defaultDurationMinutes: number;
  defaultChecklist: { id: string; label: string }[];
  description?: string;
};

export type CalendarShareLinkRecord = {
  id: string;
  token: string;
  customerId?: string;
  customerName?: string;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
};

export type DayDensityCell = {
  dateIso: string;
  count: number;
  kinds: Record<CalendarEventKind, number>;
};

// ============ Notifications ============
export type NotificationKind = 'mention' | 'thread_reply' | 'dm' | 'system' | 'deal' | 'task';

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  excerpt?: string;
  timestamp: string;
  read: boolean;
  sourceUrl: string;
  actorName?: string;
  actorInitials?: string;
  actorFrom?: string;
  actorTo?: string;
};

// ============ Direct Messages ============
export type DMUser = {
  id: string;
  name: string;
  initials: string;
  from: string;
  to: string;
  online: boolean;
  role: string;
  email: string;
  phone?: string;
};

export type DM = {
  userId: string;
  user: DMUser;
  messages: Message[];
  sharedFiles: { id: string; title: string; kind: 'doc' | 'image' | 'pdf' }[];
  sharedChannels: { slug: string; name: string }[];
};

// ============ Workspaces ============
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

export type Workspace = {
  id: string;
  slug?: string;
  name: string;
  short: string;
  from: string;
  to: string;
  unread?: number;
  description?: string;
  iconEmoji?: string;
  template?: string;
  scope?: 'business' | 'private';
  timezone?: string;
  isPublic?: boolean;
  archived?: boolean;
  role?: WorkspaceRole;
  memberCount?: number;
  ownerName?: string;
};

export type WorkspaceMember = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  from: string;
  to: string;
  role: WorkspaceRole;
  joinedAt: string;
};

export type WorkspaceInvite = {
  id: string;
  token: string;
  role: WorkspaceRole;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
  email?: string;
  createdAt: string;
  revokedAt?: string;
  createdByName?: string;
};

export type WorkspaceActivityKind =
  | 'workspace_created'
  | 'member_joined'
  | 'member_left'
  | 'member_kicked'
  | 'role_changed'
  | 'invite_created'
  | 'invite_redeemed'
  | 'invite_revoked'
  | 'settings_changed'
  | 'ownership_transferred'
  | 'workspace_archived'
  | 'workspace_unarchived';

export type WorkspaceActivityEntry = {
  id: string;
  kind: WorkspaceActivityKind;
  actor?: { id: string; name: string; initials: string; from: string; to: string };
  targetUser?: { id: string; name: string; initials: string; from: string; to: string };
  payload?: Record<string, unknown>;
  createdAt: string;
};

// ============ Todos ============
export type TodoGroup = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  position: number;
  pinned: boolean;
  archived: boolean;
  openCount: number;
  totalCount: number;
  defaultAssigneeId?: string;
  defaultPriority?: TodoPriority;
  defaultVisibility?: TodoVisibility;
  health?: GroupHealth;
};

export type TodoStatus = 'offen' | 'in_arbeit' | 'erledigt' | 'abgebrochen';
export type TodoPriority = 'niedrig' | 'mittel' | 'hoch' | 'urgent';
export type TodoVisibility = 'private' | 'team' | 'account';
export type TodoEnergy = 'deep' | 'light' | 'call' | 'admin' | 'quick';

// ─── Sprint 1: Context-Strip + Group-Health ──────────────────────
export type TodoContextStrip = {
  customerStatus?: 'aktiv' | 'lead' | 'inaktiv';
  customerSilentDays?: number;        // since last touchpoint
  contractValueCents?: number;
  contractDaysToEnd?: number;
  vehicleStatus?: 'frei' | 'vermietet' | 'wartung' | 'reserviert';
  channelUnread?: number;
};

export type TodoBlocker =
  | { kind: 'vehicle_in_wartung'; vehicleId: string; plate: string; until?: string }
  | { kind: 'vehicle_vermietet'; vehicleId: string; plate: string }
  | { kind: 'contract_storniert'; contractId: string; title: string }
  | { kind: 'customer_inaktiv'; customerId: string; name: string };

export type TodoForecastImpact = {
  valueCents: number;
  reason: string;
};

export type GroupHealth = {
  groupId: string;
  throughputLast7d: number;           // completed in last 7d
  meanCloseHours: number | null;      // hours from create→done
  staleRatio: number;                 // 0..1 of open todos older than 14d
  spark: number[];                    // 7 daily completion counts (oldest → newest)
};

// ─── Sprint 2: Workflows ────────────────────────────────────────
export type WorkflowStep = {
  id: string;
  titleTemplate: string;
  description?: string;
  position: number;
  dueOffsetMinutes?: number;
  defaultPriority?: TodoPriority;
  defaultEnergy?: TodoEnergy;
};

export type Workflow = {
  id: string;
  slug: string;
  name: string;
  emoji?: string;
  description?: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
};

// ─── Sprint 3: Share Links ───────────────────────────────────────
export type ShareLink = {
  id: string;
  token: string;
  groupId: string;
  groupName: string;
  expiresAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
};

export type TodoSubtask = {
  id: string;
  title: string;
  done: boolean;
  position: number;
};

export type TodoComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorFrom: string;
  authorTo: string;
  body: string;
  createdAt: string;
};

export type TodoActivityKind =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'due_changed'
  | 'assigned'
  | 'unassigned'
  | 'commented'
  | 'subtask_added'
  | 'subtask_completed'
  | 'subtask_removed'
  | 'snoozed'
  | 'claimed'
  | 'delegated'
  | 'delegation_accepted'
  | 'delegation_rejected'
  | 'auto_created'
  | 'completed'
  | 'cancelled';

export type TodoActivityEntry = {
  id: string;
  kind: TodoActivityKind;
  actorName?: string;
  actorInitials?: string;
  actorFrom?: string;
  actorTo?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type TodoUser = {
  id: string;
  name: string;
  initials: string;
  from: string;
  to: string;
};

export type TodoLink = {
  customer?: { id: string; slug: string; name: string };
  contract?: { id: string; externalId: string; title: string };
  vehicle?: { id: string; externalId: string; plate: string; model: string };
  channel?: { id: string; slug: string; name: string };
};

export type Todo = {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  visibility: TodoVisibility;
  dueAt?: string;
  completedAt?: string;
  snoozeUntil?: string;
  snoozeTrigger?: { kind: string; ref?: string };
  createdBy: TodoUser;
  assignee?: TodoUser;
  watchers: TodoUser[];
  subtasks: TodoSubtask[];
  comments: TodoComment[];
  activity: TodoActivityEntry[];
  links: TodoLink;
  group?: { id: string; slug: string; name: string; emoji?: string; color?: string };
  autoRuleSlug?: string;
  onDoneTemplate?: string;
  commentCount: number;
  subtaskTotal: number;
  subtaskDone: number;
  energy?: TodoEnergy;
  estimateMinutes?: number;
  context?: TodoContextStrip;
  blockers?: TodoBlocker[];
  forecastImpact?: TodoForecastImpact;
  createdAt: string;
  updatedAt: string;
};

export type AutoRuleSlug =
  | 'contract_starting_tomorrow'
  | 'contract_ending_in_14_days'
  | 'contract_ending_in_30_days'
  | 'contract_lost_followup_90d'
  | 'lead_stale_10d'
  | 'lead_stale_30d'
  | 'vehicle_service_due'
  | 'customer_inactive_30d'
  | 'customer_onboarding_30d';

export type AutoRule = {
  id: string;
  slug: AutoRuleSlug;
  enabled: boolean;
  defaultAssignee?: TodoUser;
  defaultPriority: TodoPriority;
  lastRunAt?: string;
};

// ============ Notes (Notion-style) ============
export type NoteScope = 'private' | 'workspace' | 'public';

export type NoteTreeItem = {
  id: string;
  title: string;
  icon?: string;
  parentNoteId: string | null;
  position: number;
  isTemplate: boolean;
  archived: boolean;
  scope: NoteScope;
  childCount: number;
};

// Row shape for the flat /notes overview list. Server-extracted excerpt
// keeps the document JSON out of the client bundle.
export type NoteOverviewItem = {
  id: string;
  title: string;
  icon?: string;
  parentNoteId: string | null;
  parentTitle?: string;
  scope: NoteScope;
  updatedAt: string;
  excerpt: string; // plain-text, up to ~240 chars
  isEmpty: boolean; // true if document contains no text
};

export type Note = {
  id: string;
  workspaceId: string;
  parentNoteId: string | null;
  title: string;
  icon?: string;
  coverImageUrl?: string;
  scope: NoteScope;
  shareToken?: string;
  document: unknown; // BlockNote document — opaque blob
  isTemplate: boolean;
  templateKey?: string;
  position: number;
  archivedAt?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
};

// ============ Search (Cmd+K) ============
export type SearchHit = {
  id: string;
  kind:
    | 'channel'
    | 'customer'
    | 'contract'
    | 'vehicle'
    | 'person'
    | 'action'
    | 'thread'
    | 'note';
  title: string;
  subtitle?: string;
  url: string;
  workspace?: {
    slug: string;
    name: string;
    short: string;
    from: string;
    to: string;
    scope?: 'business' | 'private';
  };
};
