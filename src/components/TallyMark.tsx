/** The Tally app mark: an orange ring, three quarters closed, on near-black. */
export default function TallyMark({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="22.5" fill="#111827" />
      <circle cx="50" cy="50" r="25" fill="none" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="10" />
      <circle cx="50" cy="50" r="25" fill="none" stroke="#F97316" strokeWidth="10" strokeLinecap="round" strokeDasharray="118 157" transform="rotate(-90 50 50)" />
    </svg>
  );
}
