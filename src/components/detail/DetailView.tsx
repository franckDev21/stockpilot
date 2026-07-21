import { useAppStore }       from '@/store/app.store'
import { OrderDetail }       from './OrderDetail'
import { CustomerDetail }    from './CustomerDetail'
import { SupplierDetail }    from './SupplierDetail'
import { ReceptionDetail }   from './ReceptionDetail'
import { TransferDetail }    from './TransferDetail'
import { ProductDetail }     from './ProductDetail'
import { WarehouseDetail }   from './WarehouseDetail'

export function DetailView() {
  const { detailPage } = useAppStore()
  if (!detailPage) return null

  switch (detailPage.type) {
    case 'order':     return <OrderDetail     id={detailPage.id} />
    case 'customer':  return <CustomerDetail  id={detailPage.id} />
    case 'supplier':  return <SupplierDetail  id={detailPage.id} />
    case 'reception': return <ReceptionDetail id={detailPage.id} />
    case 'transfer':  return <TransferDetail  id={detailPage.id} />
    case 'product':   return <ProductDetail   id={detailPage.id} />
    case 'warehouse': return <WarehouseDetail id={detailPage.id} />
    default:          return <div className="empty-state"><p className="text-slate-500">Vue non disponible pour ce type.</p></div>
  }
}
