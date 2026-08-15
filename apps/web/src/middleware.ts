import { NextRequest, NextResponse } from 'next/server';

// Routes totalement publiques
const PUBLIC_PREFIXES = [
  '/auth/',
  '/_next/',
  '/favicon',
  '/api/',
  '/manifest',
  '/icon-',
  '/robots',
];

// Préfixe de route -> rôle(s) autorisé(s)
const ROLE_PREFIXES: Record<string, string[]> = {
  '/superadmin': ['SUPER_ADMIN'],
  '/admin':      ['ADMIN'],
  '/teacher':    ['TEACHER'],
  '/parent':     ['PARENT'],
  '/student':    ['STUDENT'],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Laisser passer les routes publiques et assets
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Racine → laisser page.tsx gérer le redirect client-side
  if (pathname === '/') return NextResponse.next();

  // Le login pose ces cookies (non httpOnly, lisibles ici) en plus du localStorage.
  // Cela permet une vérification de présence de session côté serveur, avant même
  // que le JS client ne s'exécute — l'API GraphQL reste la seule source de vérité
  // pour l'autorisation réelle (le token est revérifié et signé côté serveur API).
  const token = req.cookies.get('edu_token')?.value;
  const role  = req.cookies.get('edu_role')?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('session_expired', '1');
    return NextResponse.redirect(url);
  }

  const matchedPrefix = Object.keys(ROLE_PREFIXES).find((p) => pathname.startsWith(p));
  if (matchedPrefix && role && !ROLE_PREFIXES[matchedPrefix].includes(role)) {
    const ownPrefix: Record<string, string> = {
      SUPER_ADMIN: '/superadmin/dashboard', ADMIN: '/admin/dashboard',
      TEACHER: '/teacher/dashboard', PARENT: '/parent/dashboard', STUDENT: '/student/dashboard',
    };
    const url = req.nextUrl.clone();
    url.pathname = ownPrefix[role] ?? '/auth/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
};
