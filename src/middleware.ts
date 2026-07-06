import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/api/auth/login', '/api/webhook', '/api/auth/check'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  const authHeader = request.headers.get('authorization');
  const sessionHeader = request.headers.get('x-mba-session');
  const validCode = process.env.ACCESS_CODE || 'MBA2026';
  if (authHeader === 'Bearer ' + validCode) return NextResponse.next();
  if (sessionHeader && sessionHeader.length > 0) return NextResponse.next();
  return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
}

export const config = { matcher: ['/api/:path*'] };
