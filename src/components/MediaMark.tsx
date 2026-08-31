import { isHttpImageUrl } from "@/lib/image-upload";

type MediaMarkProps = {
  src?: string | null;
  alt?: string;
  fallback?: string;
  className?: string;
  imgClassName?: string;
};

/** Renders an image URL, or emoji/text fallback for legacy logos. */
export function MediaMark({
  src,
  alt = "",
  fallback = "🏆",
  className = "",
  imgClassName = "w-8 h-8 rounded object-cover",
}: MediaMarkProps) {
  if (isHttpImageUrl(src)) {
    return (
      <img
        src={src!}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${imgClassName} ${className}`.trim()}
      />
    );
  }
  const text = (src && String(src).trim()) || fallback;
  return (
    <span className={`inline-flex items-center justify-center ${className}`.trim()}>
      {text}
    </span>
  );
}
