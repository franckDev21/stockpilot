import { type ReactNode, useId, useCallback, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Card, CardHeader } from './Card'
import { Pagination }       from './Pagination'
import { usePagination }    from '@/hooks/usePagination'

interface TableCardProps<T> {
  title:      string
  subtitle?:  string
  action?:    ReactNode
  items:      T[]
  loading?:   boolean
  pageSize?:  number
  filename?:  string
  emptyIcon?: ReactNode
  emptyText?: string
  renderEmpty?: ReactNode
  children:   (slice: T[], startIndex: number) => ReactNode
  footer?:    ReactNode
  label?:     string
  toolbar?:   ReactNode
}

export function TableCard<T>({
  title, subtitle, action, items, loading, pageSize = 6, filename,
  emptyIcon, emptyText, renderEmpty, children, footer, label = 'éléments', toolbar,
}: TableCardProps<T>) {
  const { page, totalPages, slice, goTo, total } = usePagination(items, pageSize)
  const [printing, setPrinting] = useState(false)
  const printId = useId()

  const handlePrint = useCallback(async () => {
    if (printing) return
    setPrinting(true)
    try {
      // Mark the card as the print target via a class
      const el = document.getElementById(printId)
      if (el) {
        el.classList.add('print-target')
        // Temporarily make all items visible for print
        await window.api.print.toPDF({ filename: filename ?? `${title.toLowerCase().replace(/\s+/g, '-')}.pdf` })
        el.classList.remove('print-target')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPrinting(false)
    }
  }, [printing, printId, filename, title])

  const isEmpty = !loading && items.length === 0

  return (
    <Card id={printId}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2 no-print">
            {action}
            {!isEmpty && (
              <button
                onClick={handlePrint}
                disabled={printing}
                title="Exporter ce tableau en PDF"
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {printing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                PDF
              </button>
            )}
          </div>
        }
      />

      {toolbar}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        renderEmpty ?? (
          <div className="empty-state">
            {emptyIcon && <div className="empty-state-icon">{emptyIcon}</div>}
            <p className="font-semibold text-slate-500">{emptyText ?? 'Aucun élément'}</p>
          </div>
        )
      ) : (
        <>
          {children(slice, (page - 1) * pageSize)}
          {footer}
          <div className="no-print">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={goTo} label={label} />
          </div>
        </>
      )}
    </Card>
  )
}
