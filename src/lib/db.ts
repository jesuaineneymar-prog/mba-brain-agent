import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// No Vercel, o filesystem e read-only excepto /tmp
// Se DATABASE_URL aponta para ./db/, redireciona para /tmp/
const dbUrl = process.env.DATABASE_URL || '';
const vercelDbUrl = process.env.VERCEL && dbUrl.includes('./')
  ? dbUrl.replace('file:./db/', 'file:/tmp/') || dbUrl.replace('file:./', 'file:/tmp/')
  : dbUrl;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    datasources: vercelDbUrl ? { db: { url: vercelDbUrl } } : undefined,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
