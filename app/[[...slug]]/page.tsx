import ClientApp from '../../src/ClientApp';

// Semua rute ditangani React Router di dalam ClientApp (SPA). Next hanya jadi host + SEO/OG.
export default function Page() {
  return <ClientApp />;
}
