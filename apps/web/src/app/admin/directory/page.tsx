'use client';
import { UserDirectoryTable } from '@/components/ui/UserDirectoryTable';
import { tokenStorage } from '@/lib/apollo/client';
import { Users } from 'lucide-react';

export default function AdminDirectoryPage() {
  const schoolId = tokenStorage.getSchoolId() ?? '';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--tx-primary)] flex items-center gap-2">
          <Users size={20} /> Annuaire des utilisateurs
        </h1>
        <p className="text-sm text-[var(--tx-muted)] mt-1">
          Enseignants, parents et élèves de votre établissement. Utile pour vérifier ou
          recommuniquer un identifiant si une personne appelle après avoir perdu ses accès.
        </p>
      </div>
      <UserDirectoryTable schoolId={schoolId} />
    </div>
  );
}
