import type { Permission, Role } from "@prisma/client";

export const ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "GUEST"];

/** Themed role names. Proposal — final names still to be confirmed. */
export const ROLE_META: Record<Role, { icon: string; ka: string; en: string }> = {
  OWNER: { icon: "🌟", ka: "ვარსკვლავთშემოქმედი", en: "Starforger" },
  ADMIN: { icon: "🛰️", ka: "მისიის მართვის ცენტრი", en: "Mission Control" },
  MANAGER: { icon: "🧭", ka: "ნავიგატორი", en: "Navigator" },
  MEMBER: { icon: "👩‍🚀", ka: "კოსმონავტი", en: "Astronaut" },
  GUEST: { icon: "👽", ka: "უცხოპლანეტელი", en: "Alien Visitor" },
};

export const PERMISSIONS: Permission[] = [
  "VIEW",
  "CREATE_TASK",
  "EDIT_TASK",
  "DELETE_TASK",
  "ASSIGN",
  "CHANGE_STATUS",
  "APPROVE_DONE",
  "EDIT_XP",
  "COMMENT",
  "INVITE",
  "MANAGE_STRUCTURE",
  "MANAGE_STATUSES",
  "MANAGE_FIELDS",
  "MANAGE_ROLES",
];

const ALL = new Set(PERMISSIONS);

export const DEFAULT_PERMISSIONS: Record<Role, Set<Permission>> = {
  OWNER: ALL,
  ADMIN: ALL,
  MANAGER: new Set<Permission>([
    "VIEW", "CREATE_TASK", "EDIT_TASK", "DELETE_TASK", "ASSIGN", "CHANGE_STATUS", "APPROVE_DONE",
    "EDIT_XP", "COMMENT", "INVITE", "MANAGE_STRUCTURE", "MANAGE_STATUSES", "MANAGE_FIELDS",
  ]),
  MEMBER: new Set<Permission>(["VIEW", "CREATE_TASK", "EDIT_TASK", "ASSIGN", "CHANGE_STATUS", "COMMENT"]),
  GUEST: new Set<Permission>(["VIEW", "COMMENT"]),
};
