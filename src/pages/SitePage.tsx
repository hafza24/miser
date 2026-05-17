import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DOMPurify from 'dompurify';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const SitePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPage = async () => {
      const { data } = await supabase
        .from('site_pages')
        .select('title, content')
        .eq('slug', slug!)
        .maybeSingle();
      setPage(data);
      setLoading(false);
    };
    if (slug) fetchPage();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!page) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Page not found</div>;

  // Simple markdown-to-html (handles headings, bold, bullets, italic, paragraphs)
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const html: string[] = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push(`<h1 class="text-2xl font-bold font-heading text-foreground mt-6 mb-3">${trimmed.slice(2)}</h1>`);
      } else if (trimmed.startsWith('## ')) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push(`<h2 class="text-xl font-semibold font-heading text-foreground mt-5 mb-2">${trimmed.slice(3)}</h2>`);
      } else if (trimmed.startsWith('- ')) {
        if (!inList) { html.push('<ul class="list-disc list-inside space-y-1 text-muted-foreground">'); inList = true; }
        html.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
      } else if (trimmed === '') {
        if (inList) { html.push('</ul>'); inList = false; }
      } else {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push(`<p class="text-muted-foreground leading-relaxed mb-2">${formatInline(trimmed)}</p>`);
      }
    }
    if (inList) html.push('</ul>');
    return html.join('\n');
  };

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading text-lg font-bold text-foreground">{page.title}</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }} />
      </main>
      <SiteFooter />
    </div>
  );
};

// Shared footer component
export const SiteFooter = () => {
  const navigate = useNavigate();
  const links = [
    { label: 'About', path: '/page/about' },
    { label: 'FAQ', path: '/page/faq' },
    { label: 'Privacy', path: '/page/privacy' },
    { label: 'Terms', path: '/page/terms' },
    { label: 'Contact', path: '/page/contact' },
    { label: 'Download', path: '/download' },
  ];

  return (
    <footer className="border-t border-border py-4 px-4 mt-8">
      <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {links.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="hover:text-foreground transition-colors"
          >
            {link.label}
          </button>
        ))}
        <span className="w-full text-center mt-2 opacity-60">© 2026 Fur&amp;Fir by Busistree</span>
      </div>
    </footer>
  );
};

export default SitePage;
