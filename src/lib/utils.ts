import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatFcfa(amount: number): string {
  const rounded = Math.round(amount)
  const sign = rounded < 0 ? '-' : ''
  // Thousands separated by dots: 1000000 → 1.000.000
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped} FCFA`
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-CM', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  }).format(new Date(dateStr))
}

export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-CM', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  }).format(new Date(dateStr))
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

export function pairsToCartons(pairs: number, pairsPerCarton: number): number {
  if (pairsPerCarton <= 0) return pairs
  return Math.floor(pairs / pairsPerCarton)
}

export function parseProductImages(imageData: string | null | undefined): string[] {
  if (!imageData) return []
  try {
    const parsed = JSON.parse(imageData)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [imageData]
  } catch {
    return [imageData]
  }
}

export function serializeProductImages(images: string[]): string | null {
  const filtered = images.filter(Boolean)
  return filtered.length === 0 ? null : JSON.stringify(filtered)
}
