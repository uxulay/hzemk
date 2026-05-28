import type { ReactNode } from "react";
import { ImageCell } from "@/components/ui/image-cell";
import { EllipsisText } from "@/components/ui/ellipsis-text";

type InfoCellProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  imageUrl?: string | null;
  imageAlt?: string;
  tag?: ReactNode;
};

export function InfoCell({
  title,
  subtitle,
  imageUrl,
  imageAlt = "图片",
  tag
}: InfoCellProps) {
  return (
    <div className="infoCell">
      {imageUrl !== undefined ? <ImageCell src={imageUrl} alt={imageAlt} /> : null}
      <div className="infoCellText">
        <div className="infoCellTitle">
          <EllipsisText>{title}</EllipsisText>
          {tag ? <span className="infoCellTag">{tag}</span> : null}
        </div>
        {subtitle ? <EllipsisText className="infoCellSubtitle">{subtitle}</EllipsisText> : null}
      </div>
    </div>
  );
}
