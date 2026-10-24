import type { Permission, RoleDoc } from "./types";

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

/** The Owner is not a role document: owners always have every permission. */
export const OWNER_META = { icon: "🌟", ka: "შემოქმედი", en: "Creator" };

/** Roles created on first start. Admins can rename them, change them and add new ones. */
export const DEFAULT_ROLES: RoleDoc[] = [
  { id: "admin", name: "მისიის მართვის ცენტრი", nameEn: "Mission Control", icon: "🛰️", permissions: PERMISSIONS, scopedOnly: false, position: 0 },
  {
    id: "navigator",
    name: "ნავიგატორი",
    nameEn: "Navigator",
    icon: "🧭",
    permissions: ["VIEW", "CREATE_TASK", "EDIT_TASK", "DELETE_TASK", "ASSIGN", "CHANGE_STATUS", "APPROVE_DONE", "EDIT_XP", "COMMENT", "INVITE", "MANAGE_STRUCTURE", "MANAGE_STATUSES", "MANAGE_FIELDS"],
    scopedOnly: false,
    position: 1,
  },
  {
    id: "astronaut",
    name: "კოსმონავტი",
    nameEn: "Astronaut",
    icon: "👩‍🚀",
    permissions: ["VIEW", "CREATE_TASK", "EDIT_TASK", "ASSIGN", "CHANGE_STATUS", "COMMENT"],
    scopedOnly: false,
    position: 2,
  },
  { id: "guest", name: "სტუმარი", nameEn: "Guest", icon: "👽", permissions: ["VIEW", "COMMENT"], scopedOnly: true, position: 3 },
];

export const DEFAULT_ROLE_ID = "astronaut";
export const GUEST_ROLE_ID = "guest";
