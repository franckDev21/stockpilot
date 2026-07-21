import { type ReactNode }          from 'react'
import { Header }                  from './Header'
import { DrawerRouter }            from './DrawerRouter'
import { Modal }                   from '@/components/ui/Modal'
import { DetailView }              from '@/components/detail/DetailView'
import { useAppStore }             from '@/store/app.store'
import { useKeyboardShortcuts }    from '@/hooks/useKeyboardShortcuts'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { modal, closeModal, detailPage } = useAppStore()
  useKeyboardShortcuts()

  return (
    <div className="app-shell">
      <Header />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">
          {detailPage ? <DetailView /> : children}
        </div>
      </main>

      <DrawerRouter />

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        danger
      />
    </div>
  )
}
