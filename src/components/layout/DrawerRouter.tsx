import { useAppStore } from '@/store/app.store'
import { Drawer } from '@/components/ui/Drawer'
import { ProductForm } from '@/components/forms/ProductForm'
import { SupplierForm } from '@/components/forms/SupplierForm'
import { CustomerForm } from '@/components/forms/CustomerForm'
import { WarehouseForm } from '@/components/forms/WarehouseForm'
import { PurchaseOrderForm } from '@/components/forms/PurchaseOrderForm'
import { OrderPaymentForm } from '@/components/forms/OrderPaymentForm'
import { ReceptionForm } from '@/components/forms/ReceptionForm'
import { TransferForm } from '@/components/forms/TransferForm'
import type { Product, Supplier, Customer, Warehouse, PurchaseOrder } from '@/types/domain'

type DrawerConfig = {
  title:    string
  subtitle: string
  width?:   'md' | 'lg' | 'xl'
}

const CONFIGS: Record<string, DrawerConfig> = {
  'create-product':   { title: 'Nouveau produit',           subtitle: 'Référence, marque, catégorie…',          width: 'md' },
  'edit-product':     { title: 'Modifier le produit',       subtitle: 'Mettez à jour les informations',          width: 'md' },
  'create-supplier':  { title: 'Nouveau fournisseur',       subtitle: 'Coordonnées du fournisseur',              width: 'md' },
  'edit-supplier':    { title: 'Modifier fournisseur',      subtitle: 'Mettez à jour les informations',          width: 'md' },
  'create-customer':  { title: 'Nouveau client',            subtitle: 'Grossiste (cartons) ou détail (paires)',  width: 'md' },
  'edit-customer':    { title: 'Modifier le client',        subtitle: 'Mettez à jour les informations',          width: 'md' },
  'create-warehouse': { title: 'Nouvelle boutique',         subtitle: 'Boutique ou entrepôt central',            width: 'md' },
  'edit-warehouse':   { title: 'Modifier la boutique',      subtitle: 'Mettez à jour les informations',          width: 'md' },
  'create-order':     { title: 'Nouvelle commande',         subtitle: 'Articles, coûts et simulation de profit', width: 'xl' },
  'edit-order':       { title: 'Modifier la commande',      subtitle: 'Articles, coûts et simulation de profit', width: 'xl' },
  'pay-order':          { title: 'Enregistrer un paiement',   subtitle: 'Acompte, solde ou paiement intégral',     width: 'md' },
  'create-reception':   { title: 'Nouvelle réception',        subtitle: 'Marchandise reçue du fournisseur',          width: 'lg' },
  'edit-reception':     { title: 'Modifier la réception',      subtitle: 'Ajuster les quantités reçues (super-admin)', width: 'lg' },
  'create-transfer':    { title: 'Nouveau transfert',          subtitle: 'Réapprovisionner une boutique',             width: 'lg' },
}

export function DrawerRouter() {
  const { drawer, closeDrawer, triggerRefresh } = useAppStore()
  const { isOpen, formKey, data } = drawer

  const config = formKey ? CONFIGS[formKey] : null

  const onSuccess = () => { triggerRefresh(); closeDrawer() }

  const renderForm = () => {
    switch (formKey) {
      case 'create-product':  return <ProductForm   onSuccess={onSuccess} />
      case 'edit-product':    return <ProductForm   data={data as Product}        onSuccess={onSuccess} />
      case 'create-supplier': return <SupplierForm  onSuccess={onSuccess} />
      case 'edit-supplier':   return <SupplierForm  data={data as Supplier}       onSuccess={onSuccess} />
      case 'create-customer': return <CustomerForm  onSuccess={onSuccess} />
      case 'edit-customer':   return <CustomerForm  data={data as Customer}       onSuccess={onSuccess} />
      case 'create-warehouse':return <WarehouseForm onSuccess={onSuccess} />
      case 'edit-warehouse':  return <WarehouseForm data={data as Warehouse}      onSuccess={onSuccess} />
      case 'create-order':    return <PurchaseOrderForm                           onSuccess={onSuccess} />
      case 'edit-order':      return <PurchaseOrderForm orderId={(data as PurchaseOrder).id} onSuccess={onSuccess} />
      case 'pay-order':         return <OrderPaymentForm orderId={(data as PurchaseOrder).id} onSuccess={onSuccess} />
      case 'create-reception':  return <ReceptionForm onSuccess={onSuccess} />
      case 'edit-reception':    return <ReceptionForm receptionId={(data as { id: string }).id} onSuccess={onSuccess} />
      case 'create-transfer':   return <TransferForm  onSuccess={onSuccess} />
      default: return null
    }
  }

  if (!config) return null

  return (
    <Drawer
      isOpen={isOpen}
      onClose={closeDrawer}
      title={config.title}
      subtitle={config.subtitle}
      width={config.width}
    >
      {isOpen && renderForm()}
    </Drawer>
  )
}
