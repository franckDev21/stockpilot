import { formatFcfa, formatDate } from '@/lib/utils'

interface InvoiceItem {
  id: string
  productId: string
  size: string
  quantity: number
  unitPriceFcfa: number
}

interface InvoicePayment {
  id: string
  amountFcfa: number
  paymentDate: string
  type: string
}

export interface InvoiceData {
  reference: string
  saleDate: string
  saleType: string
  status: string
  totalAmountFcfa: number
  paidAmountFcfa: number
  notes: string | null
  items: InvoiceItem[]
  payments: InvoicePayment[]
  customerName: string
  customerPhone?: string | null
  warehouseName: string
  productNames: Record<string, string>
}

const STATUS_LABEL: Record<string, string> = {
  paid:    'Soldée',
  partial: 'Partiellement réglée',
  pending: 'En attente de paiement',
}

const STATUS_COLOR: Record<string, string> = {
  paid:    '#059669',
  partial: '#2563eb',
  pending: '#d97706',
}

const PAYMENT_TYPE: Record<string, string> = {
  cash:     'Espèces',
  transfer: 'Virement',
  check:    'Chèque',
  mobile:   'Mobile Money',
}

export function InvoiceTemplate({ data }: { data: InvoiceData }) {
  const remaining = data.totalAmountFcfa - data.paidAmountFcfa

  return (
    <div style={{
      fontFamily: 'Arial, Helvetica, sans-serif',
      background: '#ffffff',
      color: '#1e293b',
      padding: '40px 48px',
      maxWidth: '760px',
      margin: '0 auto',
      fontSize: '13px',
      lineHeight: '1.5',
    }}>

      {/* ── En-tête ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#4f46e5', letterSpacing: '-0.5px' }}>
            Feujio Import Chaussures
          </div>
          <div style={{ marginTop: '6px', color: '#64748b', fontSize: '12px' }}>
            Douala, Cameroun
          </div>
          <div style={{ color: '#64748b', fontSize: '12px' }}>
            Commerce de chaussures en gros et en détail
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', letterSpacing: '2px' }}>
            FACTURE
          </div>
          <div style={{ marginTop: '4px', fontSize: '15px', fontWeight: '700', color: '#4f46e5' }}>
            {data.reference}
          </div>
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
            {formatDate(data.saleDate)}
          </div>
          <div style={{
            display: 'inline-block',
            marginTop: '8px',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '700',
            background: STATUS_COLOR[data.status] + '18',
            color: STATUS_COLOR[data.status],
            border: `1px solid ${STATUS_COLOR[data.status]}40`,
          }}>
            {STATUS_LABEL[data.status] ?? data.status}
          </div>
        </div>
      </div>

      {/* ── Séparateur ───────────────────────────────────────── */}
      <div style={{ borderTop: '2px solid #e2e8f0', marginBottom: '28px' }} />

      {/* ── Client & Boutique ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '28px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Facturé à
          </div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
            {data.customerName}
          </div>
          {data.customerPhone && (
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
              {data.customerPhone}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Boutique
          </div>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
            {data.warehouseName}
          </div>
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
            Vente en {data.saleType === 'wholesale' ? 'gros' : 'détail'}
          </div>
        </div>
      </div>

      {/* ── Articles ─────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Article
            </th>
            <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Taille
            </th>
            <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Qté
            </th>
            <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              P.U.
            </th>
            <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
              <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f172a' }}>
                {data.productNames[item.productId] ?? item.productId}
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                <span style={{ background: '#f1f5f9', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                  {item.size}
                </span>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700', color: '#1e293b' }}>
                {item.quantity}
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                {formatFcfa(item.unitPriceFcfa)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {formatFcfa(item.quantity * item.unitPriceFcfa)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totaux ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
        <div style={{ minWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b' }}>Total HT</span>
            <span style={{ fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{formatFcfa(data.totalAmountFcfa)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b' }}>Montant encaissé</span>
            <span style={{ fontWeight: '700', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{formatFcfa(data.paidAmountFcfa)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: remaining > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${remaining > 0 ? '#fde68a' : '#bbf7d0'}` }}>
            <span style={{ fontWeight: '800', color: remaining > 0 ? '#92400e' : '#065f46' }}>
              {remaining > 0 ? 'Reste à payer' : 'Solde'}
            </span>
            <span style={{ fontWeight: '900', fontSize: '15px', color: remaining > 0 ? '#d97706' : '#059669', fontVariantNumeric: 'tabular-nums' }}>
              {remaining > 0 ? formatFcfa(remaining) : 'Soldé ✓'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Historique paiements (si >1) ─────────────────── */}
      {data.payments.length > 0 && (
        <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            Historique des paiements
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '4px 0', color: '#475569', fontSize: '12px' }}>{formatDate(p.paymentDate)}</td>
                  <td style={{ padding: '4px 0', color: '#475569', fontSize: '12px' }}>{PAYMENT_TYPE[p.type] ?? p.type}</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: '700', color: '#059669', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                    {formatFcfa(p.amountFcfa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Notes ────────────────────────────────────────── */}
      {data.notes && (
        <div style={{ marginBottom: '24px', padding: '12px 16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e' }}>
          <span style={{ fontWeight: '700' }}>Note : </span>{data.notes}
        </div>
      )}

      {/* ── Pied de page ─────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
          Généré par StockPilot — Feujio Import Chaussures
        </div>
        <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: '11px' }}>
          <div style={{ fontWeight: '700', color: '#4f46e5' }}>Merci pour votre confiance !</div>
        </div>
      </div>

    </div>
  )
}
