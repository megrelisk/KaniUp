// Firestore document shapes. Dates are ISO strings so they serialize to the client as-is.

export type Permission =
  | "VIEW"
  | "CREATE_TASK"
  | "EDIT_TASK"
  | "DELETE_TASK"
  | "ASSIGN"
  | "CHANGE_STATUS"
  | "APPROVE_DONE"
  | "EDIT_XP"
  | "COMMENT"
  | "INVITE"
  | "MANAGE_STRUCTURE"
  | "MANAGE_STATUSES"
  | "MANAGE_FIELDS"
  | "MANAGE_ROLES";

export type ScopeType = "GALAXY" | "FOLDER" | "PLANET";
export type Difficulty = "EASY" | "NORMAL" | "HARD" | "EPIC" | "LEGENDARY";
export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type StatusKind = "BACKLOG" | "OPEN" | "ACTIVE" | "REVIEW" | "DONE";
export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX" | "URL";

/** A role. Admins can create new ones; `scopedOnly` roles (guests) see only places they were granted. */
export type RoleDoc = {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  permissions: Permission[];
  scopedOnly: boolean;
  position: number;
};

export type UserDoc = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  roleId: string;
  isOwner: boolean;
  xp: number;
  streak: number;
  bestStreak: number;
  lastStreakDay: string | null;
  /** Second streak: consecutive days the user opened KaniUp at all. */
  visitStreak: number;
  bestVisitStreak: number;
  lastVisitDay: string | null;
  achievements: Record<string, string>;
  phone: string | null;
  pushTokens?: string[];
  deactivatedAt: string | null;
  createdAt: string;
};

export type GrantDoc = { id: string; userId: string; roleId: string; scopeType: ScopeType; scopeId: string };

/** Changes one permission of a role inside a galaxy / folder / planet. */
export type OverrideDoc = { id: string; roleId: string; permission: Permission; allowed: boolean; scopeType: ScopeType; scopeId: string };

export type GalaxyDoc = { id: string; name: string; icon: string; color: string; position: number; createdAt: string; deletedAt: string | null };

export type FolderDoc = {
  id: string;
  name: string;
  galaxyId: string;
  planetId: string | null;
  parentId: string | null;
  position: number;
  createdAt: string;
  deletedAt: string | null;
};

export type Status = { id: string; name: string; color: string; kind: StatusKind; position: number };
export type CustomField = { id: string; name: string; type: CustomFieldType; options: string[] };

export type PlanetDoc = {
  id: string;
  name: string;
  icon: string;
  color: string;
  galaxyId: string;
  folderId: string | null;
  position: number;
  statuses: Status[];
  customFields: CustomField[];
  tags: Record<string, string>; // name → color
  createdAt: string;
  deletedAt: string | null;
};

export type Attachment = { id: string; name: string; mime: string; size: number; path: string; uploaderId: string; createdAt: string };

export type TaskDoc = {
  id: string;
  number: number;
  title: string;
  description: string;
  planetId: string;
  folderId: string | null;
  parentId: string | null;
  statusId: string;
  difficulty: Difficulty;
  priority: Priority;
  xp: number;
  xpOverride: boolean;
  assigneeIds: string[];
  xpShares: Record<string, number>; // userId → percent
  tags: string[];
  fields: Record<string, string>; // custom field id → value
  attachments: Attachment[];
  timeSpentSec: number;
  timers: Record<string, string>; // userId → running since (ISO)
  startDate: string | null;
  dueDate: string | null;
  position: number;
  creatorId: string;
  completedAt: string | null;
  reviewedAt: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CommentDoc = {
  id: string;
  taskId: string;
  authorId: string | null;
  parentId: string | null;
  body: string;
  system: boolean;
  mentions: string[];
  reactions: Record<string, string[]>; // emoji → user ids
  attachments: Attachment[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type InvitationDoc = {
  id: string; // also the token
  email: string;
  roleId: string;
  scopeType: ScopeType | null;
  scopeId: string | null;
  inviterId: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type XpEventDoc = { id: string; userId: string; taskId: string | null; amount: number; difficulty: Difficulty | null; reason: string; createdAt: string };

export type ActivityDoc = { id: string; taskId: string; actorId: string | null; action: string; data: Record<string, unknown>; createdAt: string };

export type NotifyEvent = "assigned" | "mention" | "comment" | "review" | "done" | "level_up" | "due_today" | "overdue";
export type NotifyChannel = "inApp" | "email" | "push" | "sms";

/** Which channels each event uses. Only admins change this (settings/notifications). */
export type NotifySettings = Record<NotifyEvent, NotifyChannel[]>;

export type NotificationDoc = {
  id: string;
  userId: string;
  event: NotifyEvent;
  title: string;
  body: string;
  url: string;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
};
