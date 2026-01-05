import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ChineseImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Component to display images from Chinese e-commerce sites (Taobao, Tmall, 1688, JD)
 * These sites often block direct access from foreign IPs, so we use fallback handling
 */
export function ChineseImage({ src, alt = '', className = '', fallback }: ChineseImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || error) {
    return fallback || (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  // Convert Chinese CDN URLs to use HTTPS and proper format
  let imageUrl = src;
  if (imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  }
  
  // Remove size constraints from alicdn URLs to get full resolution
  imageUrl = imageUrl
    .replace(/_\d+x\d+\.[a-z]+$/i, '')
    .replace(/\.(jpg|png|webp)_\d+x\d+\.[a-z]+$/i, '.$1');

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`${className} ${!loaded ? 'animate-pulse bg-muted' : ''}`}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
}

/**
 * Get a properly formatted image URL for Chinese e-commerce sites
 */
export function getChineseImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  let imageUrl = url;
  if (imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  }
  
  // Remove size constraints
  imageUrl = imageUrl
    .replace(/_\d+x\d+\.[a-z]+$/i, '')
    .replace(/\.(jpg|png|webp)_\d+x\d+\.[a-z]+$/i, '.$1');
    
  return imageUrl;
}

/**
 * Check if a URL is from a Chinese e-commerce CDN
 */
export function isChineseCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const cdnDomains = ['alicdn.com', 'taobaocdn.com', 'tbcdn.com', 'jd.com', '1688.com'];
  return cdnDomains.some(domain => url.includes(domain));
}

export default ChineseImage;
