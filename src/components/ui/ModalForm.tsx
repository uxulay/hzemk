"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/Modal";

type ModalFormProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
};

export function ModalForm({
  open,
  title,
  eyebrow = "表单",
  children,
  onClose
}: ModalFormProps) {
  return (
    <Modal open={open} title={title} eyebrow={eyebrow} maxWidth="lg" onClose={onClose}>
      {children}
    </Modal>
  );
}
