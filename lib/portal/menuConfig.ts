/**
 * Teacher Portal Navigation & Menu Configuration Manager
 * 
 * Manages customizable navigation items for the Teacher Educator Portal.
 * Supports enabling/disabling standard modules, adding custom school/department links,
 * reordering, local storage persistence, and reactive CustomEvent broadcasting.
 */

export type PortalNavSection = 'teaching' | 'analytics' | 'verification' | 'school' | 'custom';

export interface PortalNavItem {
  id: string;
  label: string;
  section: PortalNavSection;
  iconName: string;
  enabled: boolean;
  isCustom?: boolean;
  href?: string;
  badge?: string;
  order: number;
}

export const PORTAL_NAV_STORAGE_KEY = 'revizz_portal_nav_config';
export const PORTAL_NAV_CHANGE_EVENT = 'revizz_portal_nav_changed';

export const DEFAULT_PORTAL_NAV_ITEMS: PortalNavItem[] = [
  // Teaching Section
  {
    id: 'overview',
    label: 'Overview',
    section: 'teaching',
    iconName: 'LayoutGrid',
    enabled: true,
    order: 0,
  },
  {
    id: 'roster',
    label: 'Classes & students',
    section: 'teaching',
    iconName: 'Users',
    enabled: true,
    order: 1,
  },
  {
    id: 'assign',
    label: 'Assign rounds',
    section: 'teaching',
    iconName: 'Send',
    enabled: true,
    order: 2,
  },
  {
    id: 'compiler',
    label: 'Test compiler',
    section: 'teaching',
    iconName: 'FileText',
    badge: 'New',
    enabled: true,
    order: 3,
  },

  // Analytics Section
  {
    id: 'mastery',
    label: 'Mastery analytics',
    section: 'analytics',
    iconName: 'BarChart3',
    enabled: true,
    order: 4,
  },
  {
    id: 'xp',
    label: 'Leaderboard & XP',
    section: 'analytics',
    iconName: 'Trophy',
    enabled: true,
    order: 5,
  },

  // Question Verification Section
  {
    id: 'bank',
    label: 'Question bank',
    section: 'verification',
    iconName: 'BookOpen',
    enabled: true,
    order: 6,
  },
  {
    id: 'flagged',
    label: 'Flagged questions',
    section: 'verification',
    iconName: 'Flag',
    enabled: true,
    order: 7,
  },

  // School Section
  {
    id: 'school',
    label: 'School & licence',
    section: 'school',
    iconName: 'Building2',
    enabled: true,
    order: 8,
  },
];

/**
 * Returns a fresh clone of the standard default portal navigation items.
 */
export function getDefaultPortalNavItems(): PortalNavItem[] {
  return JSON.parse(JSON.stringify(DEFAULT_PORTAL_NAV_ITEMS));
}

/**
 * Dispatches an event notifying the app that portal navigation config has changed.
 */
function notifyNavConfigChanged(items: PortalNavItem[]): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      const event = new CustomEvent(PORTAL_NAV_CHANGE_EVENT, { detail: items });
      window.dispatchEvent(event);
    } catch {
      // In non-DOM / test environments where CustomEvent might be primitive
      window.dispatchEvent({ type: PORTAL_NAV_CHANGE_EVENT, detail: items } as any);
    }
  }
}

/**
 * Retrieves the full list of portal nav items from localStorage,
 * falling back to defaults if not found or corrupted.
 */
export function getPortalNavItems(): PortalNavItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultPortalNavItems();
  }

  try {
    const raw = window.localStorage.getItem(PORTAL_NAV_STORAGE_KEY);
    if (!raw) {
      return getDefaultPortalNavItems();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return getDefaultPortalNavItems();
    }
    return parsed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (err) {
    console.error('Failed to parse portal nav configuration from storage:', err);
    return getDefaultPortalNavItems();
  }
}

/**
 * Returns only the active (enabled === true) portal nav items, ordered by their sort index.
 */
export function getActivePortalMenuItems(): PortalNavItem[] {
  return getPortalNavItems().filter((item) => item.enabled);
}

/**
 * Saves the given navigation items to localStorage and broadcasts an update event.
 */
export function savePortalNavItems(items: PortalNavItem[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(PORTAL_NAV_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save portal nav items to localStorage:', err);
    }
  }
  notifyNavConfigChanged(items);
}

/**
 * Toggles an item's enabled state by ID.
 * Returns the updated item array.
 */
export function togglePortalMenuItem(id: string): PortalNavItem[] {
  const items = getPortalNavItems();
  const updated = items.map((item) => {
    if (item.id === id) {
      return { ...item, enabled: !item.enabled };
    }
    return item;
  });

  savePortalNavItems(updated);
  return updated;
}

/**
 * Sets an item's enabled state explicitly by ID.
 */
export function setPortalMenuItemEnabled(id: string, enabled: boolean): PortalNavItem[] {
  const items = getPortalNavItems();
  const updated = items.map((item) => {
    if (item.id === id) {
      return { ...item, enabled };
    }
    return item;
  });

  savePortalNavItems(updated);
  return updated;
}

/**
 * Adds a new custom menu item to the configuration.
 * Validates unique ID and appends to order if unspecified.
 */
export function addPortalMenuItem(
  item: Omit<PortalNavItem, 'order'> & { order?: number }
): PortalNavItem[] {
  const items = getPortalNavItems();

  // Guard against duplicate IDs
  if (items.some((i) => i.id === item.id)) {
    throw new Error(`Menu item with id "${item.id}" already exists.`);
  }

  const maxOrder = items.reduce((max, i) => Math.max(max, i.order ?? 0), -1);
  const newItem: PortalNavItem = {
    ...item,
    isCustom: true,
    order: item.order !== undefined ? item.order : maxOrder + 1,
    enabled: item.enabled !== undefined ? item.enabled : true,
    section: item.section || 'custom',
    iconName: item.iconName || 'Link',
  };

  const updated = [...items, newItem].sort((a, b) => a.order - b.order);
  savePortalNavItems(updated);
  return updated;
}

/**
 * Removes a custom menu item from the configuration.
 * Standard core items cannot be removed (they can only be disabled).
 */
export function removePortalMenuItem(id: string): PortalNavItem[] {
  const items = getPortalNavItems();
  const target = items.find((i) => i.id === id);

  if (!target) {
    return items;
  }

  if (!target.isCustom) {
    throw new Error(`Cannot delete standard core item "${id}". Use togglePortalMenuItem to disable it instead.`);
  }

  const updated = items.filter((i) => i.id !== id);
  savePortalNavItems(updated);
  return updated;
}

/**
 * Resets the portal navigation configuration to the default standard items.
 */
export function resetPortalNavToDefaults(): PortalNavItem[] {
  const defaults = getDefaultPortalNavItems();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(PORTAL_NAV_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear portal nav items from localStorage:', err);
    }
  }
  notifyNavConfigChanged(defaults);
  return defaults;
}
