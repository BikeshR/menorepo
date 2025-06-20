import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UIState, Notification } from './types'

interface UIStoreState extends UIState {
  notifications: Notification[]
  lastSyncedAt: Date | null
  isOnline: boolean
  commandPaletteOpen: boolean
  recentSearches: string[]
  keyboardShortcutsEnabled: boolean
}

interface UIActions {
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openModal: (modalId: string) => void
  closeModal: () => void
  toggleBulkOperationMode: () => void
  setSelectedPatents: (patentIds: string[]) => void
  addSelectedPatent: (patentId: string) => void
  removeSelectedPatent: (patentId: string) => void
  clearSelectedPatents: () => void
  setSearchQuery: (query: string) => void
  addRecentSearch: (query: string) => void
  clearRecentSearches: () => void
  updateFilters: (filters: Partial<UIStoreState['filters']>) => void
  clearFilters: () => void
  setSorting: (field: string, direction: 'asc' | 'desc') => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  setLastSyncedAt: (date: Date) => void
  setOnlineStatus: (online: boolean) => void
  toggleCommandPalette: () => void
  setCommandPaletteOpen: (open: boolean) => void
  toggleKeyboardShortcuts: () => void
}

type UIStore = UIStoreState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      activeModal: null,
      selectedPatents: [],
      bulkOperationMode: false,
      searchQuery: '',
      filters: {
        status: [],
        dateRange: null,
        inventors: [],
        assignee: [],
        classifications: [],
      },
      sorting: {
        field: 'filingDate',
        direction: 'desc',
      },
      notifications: [],
      lastSyncedAt: null,
      isOnline: true,
      commandPaletteOpen: false,
      recentSearches: [],
      keyboardShortcutsEnabled: true,

      // Actions
      toggleSidebar: () => {
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        }), false, 'ui/toggleSidebar')
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed }, false, 'ui/setSidebarCollapsed')
      },

      openModal: (modalId) => {
        set({ activeModal: modalId }, false, 'ui/openModal')
      },

      closeModal: () => {
        set({ activeModal: null }, false, 'ui/closeModal')
      },

      toggleBulkOperationMode: () => {
        set((state) => {
          const newMode = !state.bulkOperationMode
          return {
            bulkOperationMode: newMode,
            selectedPatents: newMode ? state.selectedPatents : [],
          }
        }, false, 'ui/toggleBulkOperationMode')
      },

      setSelectedPatents: (patentIds) => {
        set({ selectedPatents: patentIds }, false, 'ui/setSelectedPatents')
      },

      addSelectedPatent: (patentId) => {
        set((state) => ({
          selectedPatents: [...state.selectedPatents, patentId],
        }), false, 'ui/addSelectedPatent')
      },

      removeSelectedPatent: (patentId) => {
        set((state) => ({
          selectedPatents: state.selectedPatents.filter(id => id !== patentId),
        }), false, 'ui/removeSelectedPatent')
      },

      clearSelectedPatents: () => {
        set({ selectedPatents: [] }, false, 'ui/clearSelectedPatents')
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query }, false, 'ui/setSearchQuery')
      },

      addRecentSearch: (query) => {
        if (!query.trim()) return
        
        set((state) => {
          const filtered = state.recentSearches.filter(s => s !== query)
          return {
            recentSearches: [query, ...filtered].slice(0, 10),
          }
        }, false, 'ui/addRecentSearch')
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] }, false, 'ui/clearRecentSearches')
      },

      updateFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }), false, 'ui/updateFilters')
      },

      clearFilters: () => {
        set({
          filters: {
            status: [],
            dateRange: null,
            inventors: [],
            assignee: [],
            classifications: [],
          },
        }, false, 'ui/clearFilters')
      },

      setSorting: (field, direction) => {
        set({ sorting: { field, direction } }, false, 'ui/setSorting')
      },

      addNotification: (notificationData) => {
        const notification: Notification = {
          ...notificationData,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          read: false,
        }

        set((state) => ({
          notifications: [notification, ...state.notifications],
        }), false, 'ui/addNotification')
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map(notif =>
            notif.id === id ? { ...notif, read: true } : notif
          ),
        }), false, 'ui/markNotificationRead')
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(notif => notif.id !== id),
        }), false, 'ui/removeNotification')
      },

      clearNotifications: () => {
        set({ notifications: [] }, false, 'ui/clearNotifications')
      },

      setLastSyncedAt: (date) => {
        set({ lastSyncedAt: date }, false, 'ui/setLastSyncedAt')
      },

      setOnlineStatus: (online) => {
        set({ isOnline: online }, false, 'ui/setOnlineStatus')
      },

      toggleCommandPalette: () => {
        set((state) => ({
          commandPaletteOpen: !state.commandPaletteOpen,
        }), false, 'ui/toggleCommandPalette')
      },

      setCommandPaletteOpen: (open) => {
        set({ commandPaletteOpen: open }, false, 'ui/setCommandPaletteOpen')
      },

      toggleKeyboardShortcuts: () => {
        set((state) => ({
          keyboardShortcutsEnabled: !state.keyboardShortcutsEnabled,
        }), false, 'ui/toggleKeyboardShortcuts')
      },
    }),
    {
      name: 'ui-store',
    }
  )
)

// Selectors
export const useSidebarCollapsed = () => useUIStore((state) => state.sidebarCollapsed)
export const useActiveModal = () => useUIStore((state) => state.activeModal)
export const useSelectedPatents = () => useUIStore((state) => state.selectedPatents)
export const useBulkOperationMode = () => useUIStore((state) => state.bulkOperationMode)
export const useSearchQuery = () => useUIStore((state) => state.searchQuery)
export const useFilters = () => useUIStore((state) => state.filters)
export const useSorting = () => useUIStore((state) => state.sorting)
export const useNotifications = () => useUIStore((state) => state.notifications)
export const useUnreadNotifications = () => useUIStore((state) => 
  state.notifications.filter(n => !n.read)
)
export const useIsOnline = () => useUIStore((state) => state.isOnline)
export const useCommandPaletteOpen = () => useUIStore((state) => state.commandPaletteOpen)