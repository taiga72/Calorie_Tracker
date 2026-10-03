import { usePhotoUrl } from '@/lib/photoStorage';

/**
 * A meal photo, whether stored in Supabase Storage or still inline. Shows a
 * soft placeholder of the same size while the link is being fetched.
 */
export function MealPhoto({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const url = usePhotoUrl(src);
  if (!url) return <div role="img" aria-label={alt} className={`${className} bg-gray-100 dark:bg-gray-800 animate-pulse`} />;
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={className} />;
}
