'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/apollo/client';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token    = tokenStorage.getToken();
    const schoolId = tokenStorage.getSchoolId();

    if (!token) {
      router.replace('/auth/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role    = payload.role as string;
      const school  = schoolId ?? payload.schoolId;

      if (!school) {
        router.replace('/auth/workspace');
        return;
      }

      switch (role) {
        case 'SUPER_ADMIN': router.replace('/superadmin/dashboard'); break;
        case 'ADMIN':       router.replace('/admin/dashboard'); break;
        case 'TEACHER':     router.replace('/teacher/dashboard'); break;
        case 'PARENT':      router.replace('/parent/dashboard'); break;
        case 'STUDENT':     router.replace('/student/dashboard'); break;
        default:            router.replace('/auth/login');
      }
    } catch {
      router.replace('/auth/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[var(--bd)] border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-[var(--tx-muted)] text-sm">Chargement...</p>
      </div>
    </div>
  );
}
