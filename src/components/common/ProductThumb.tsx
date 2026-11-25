import React, { useState } from 'react';
import { CakeSlice } from 'lucide-react';

interface ProductThumbProps {
  src?: string;
  alt: string;
  className?: string;
  borderless?: boolean;
}

export const ProductThumb: React.FC<ProductThumbProps> = ({
  src,
  alt,
  className = 'w-12 h-12 rounded-md',
  borderless = false,
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-[#FAF9F5] ${
          borderless ? '' : 'border border-[#E5E7EB]'
        } flex items-center justify-center text-[#FB923C] shrink-0 overflow-hidden`}
        aria-label={alt}
      >
        <CakeSlice className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover shrink-0 bg-[#FAF9F5] ${
        borderless ? '' : 'border border-[#E5E7EB]/60'
      }`}
    />
  );
};
