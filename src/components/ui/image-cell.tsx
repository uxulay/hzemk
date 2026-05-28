"use client";

import { ImageCell as LegacyImageCell } from "@/components/ImageCell";

type ImageCellProps = {
  src?: string | null;
  alt: string;
  placeholder?: string;
};

export function ImageCell(props: ImageCellProps) {
  return <LegacyImageCell {...props} />;
}
