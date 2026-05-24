"use client";

import { useState } from "react";

type ImageCellProps = {
  src?: string | null;
  alt: string;
  placeholder?: string;
};

export function ImageCell({ src, alt, placeholder = "无图" }: ImageCellProps) {
  const [failed, setFailed] = useState(false);
  const imageUrl = src?.trim();

  if (!imageUrl || failed) {
    return (
      <div className="imageCellPlaceholder" aria-label={`${alt}暂无图片`}>
        {placeholder}
      </div>
    );
  }

  return (
    <img
      className="imageCellThumb"
      src={imageUrl}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
