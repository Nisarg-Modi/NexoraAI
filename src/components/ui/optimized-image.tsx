import { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
}

/**
 * OptimizedImage component that adds performance optimizations:
 * - Native lazy loading for non-priority images
 * - Async decoding to avoid blocking the main thread
 * - Fetchpriority hint for critical images
 */
export const OptimizedImage = ({
  src,
  alt,
  priority = false,
  className,
  sizes,
  ...props
}: OptimizedImageProps) => {
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      // @ts-ignore - fetchpriority is a valid HTML attribute but not yet in React types
      fetchpriority={priority ? "high" : "auto"}
      sizes={sizes}
      className={cn(className)}
      {...props}
    />
  );
};

export default OptimizedImage;
