import { create } from 'zustand'

type DrawerState = {
  isOpen:  boolean
  formKey: string | null
  data:    unknown
}

type ModalState = {
  isOpen:    boolean
  title:     string
  message:   string
  onConfirm: (() => void) | undefined
}

type DetailPage = {
  type: string
  id:   string
}

interface AppState {
  // Refresh trigger — incremented after any CRUD so all hooks re-fetch
  dataVersion:    number
  triggerRefresh: () => void

  // Page de détail (vue complète avec retour)
  detailPage:  DetailPage | null
  openDetail:  (type: string, id: string) => void
  closeDetail: () => void

  // Drawer (formulaires complexes — glisse depuis la droite)
  drawer:      DrawerState
  openDrawer:  (formKey: string, data?: unknown) => void
  closeDrawer: () => void

  // Modal (actions simples — confirmation, alerte)
  modal:       ModalState
  openModal:   (title: string, message: string, onConfirm?: () => void) => void
  closeModal:  () => void
}

export const useAppStore = create<AppState>((set) => ({
  dataVersion:    0,
  triggerRefresh: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),

  detailPage:  null,
  openDetail:  (type, id) => set({ detailPage: { type, id } }),
  closeDetail: ()         => set({ detailPage: null }),

  drawer:      { isOpen: false, formKey: null, data: null },
  openDrawer:  (formKey, data = null) => set({ drawer: { isOpen: true, formKey, data } }),
  closeDrawer: ()  => set({ drawer: { isOpen: false, formKey: null, data: null } }),

  modal:      { isOpen: false, title: '', message: '', onConfirm: undefined },
  openModal:  (title, message, onConfirm) =>
    set({ modal: { isOpen: true, title, message, onConfirm } }),
  closeModal: () =>
    set({ modal: { isOpen: false, title: '', message: '', onConfirm: undefined } }),
}))
