'use client';
import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Download, Loader2, FileText } from 'lucide-react';
import { GENERATE_BULLETIN_PDF_MUTATION } from '@/lib/graphql/queries';
import { apiDocumentUrl } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface Props {
  bulletinId:     string;
  pdfUrl?:        string | null;
  isDownloadable: boolean;
  size?:          'sm' | 'md';
  variant?:       'button' | 'icon';
}

export function BulletinDownloadButton({
  bulletinId, pdfUrl, isDownloadable, size = 'md', variant = 'button',
}: Props) {
  const { addToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [generatePdf] = useMutation(GENERATE_BULLETIN_PDF_MUTATION);

  if (!isDownloadable) {
    return (
      <span title="Paiements incomplets pour ce trimestre"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--tx-muted)] cursor-not-allowed">
        <FileText size={14} />
        {variant === 'button' && 'Paiement requis'}
      </span>
    );
  }

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Générer/récupérer le pdfUrl
      let url = pdfUrl;
      if (!url) {
        const { data } = await generatePdf({ variables: { bulletinId } });
        url = data?.generateBulletinPdf?.pdfUrl;
      }
      if (!url) throw new Error('URL PDF manquante');

      window.open(apiDocumentUrl(url), '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Erreur PDF', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const iconSize = size === 'sm' ? 13 : 15;

  if (variant === 'icon') {
    return (
      <button onClick={handleDownload} disabled={generating}
        title="Télécharger le bulletin PDF"
        className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--tx-secondary)]
                   disabled:opacity-50 disabled:cursor-wait transition-colors">
        {generating
          ? <Loader2 size={iconSize} className="animate-spin" />
          : <Download size={iconSize} />}
      </button>
    );
  }

  return (
    <button onClick={handleDownload} disabled={generating}
      className={`btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait
        ${size === 'sm' ? 'text-xs py-1 px-2.5' : 'text-sm'}`}>
      {generating
        ? <Loader2 size={iconSize} className="animate-spin" />
        : <Download size={iconSize} />}
      {generating ? 'Génération…' : 'Bulletin PDF'}
    </button>
  );
}
