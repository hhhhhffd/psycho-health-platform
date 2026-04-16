/**
 * Утилита для объединения CSS классов.
 * Используется компонентами Shadcn UI для условного применения стилей.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
