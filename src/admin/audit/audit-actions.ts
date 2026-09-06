export const AuditAction = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',

  // Users
  USER_CREATED: 'USER_CREATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  ROLE_CHANGED: 'ROLE_CHANGED',

  // Stories
  STORY_CREATED: 'STORY_CREATED',
  STORY_UPDATED: 'STORY_UPDATED',
  STORY_DELETED: 'STORY_DELETED',
  STORY_VISIBILITY_CHANGED: 'STORY_VISIBILITY_CHANGED',

  // Sharing
  STORY_SHARED: 'STORY_SHARED',
  STORY_ACCESS_REMOVED: 'STORY_ACCESS_REMOVED',

  // AI Generation
  STORY_GENERATION_STARTED: 'STORY_GENERATION_STARTED',
  STORY_GENERATION_COMPLETED: 'STORY_GENERATION_COMPLETED',
  STORY_GENERATION_FAILED: 'STORY_GENERATION_FAILED',
  GENERATION_RETRY: 'GENERATION_RETRY',

  // System (admin-only)
  AI_USAGE_RESET: 'AI_USAGE_RESET',
  QUEUE_CLEAN: 'QUEUE_CLEAN',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ACTIONS_LIST: readonly AuditActionValue[] =
  Object.values(AuditAction);

export const AUDIT_ACTION_CATEGORIES = {
  authentication: [
    AuditAction.LOGIN_SUCCESS,
    AuditAction.LOGIN_FAILED,
    AuditAction.LOGOUT,
    AuditAction.REGISTER,
    AuditAction.PASSWORD_CHANGED,
  ],
  users: [
    AuditAction.USER_CREATED,
    AuditAction.USER_ACTIVATED,
    AuditAction.USER_DEACTIVATED,
    AuditAction.ROLE_CHANGED,
  ],
  stories: [
    AuditAction.STORY_CREATED,
    AuditAction.STORY_UPDATED,
    AuditAction.STORY_DELETED,
    AuditAction.STORY_VISIBILITY_CHANGED,
  ],
  sharing: [AuditAction.STORY_SHARED, AuditAction.STORY_ACCESS_REMOVED],
  generation: [
    AuditAction.STORY_GENERATION_STARTED,
    AuditAction.STORY_GENERATION_COMPLETED,
    AuditAction.STORY_GENERATION_FAILED,
    AuditAction.GENERATION_RETRY,
  ],
  system: [AuditAction.AI_USAGE_RESET, AuditAction.QUEUE_CLEAN],
} as const;
