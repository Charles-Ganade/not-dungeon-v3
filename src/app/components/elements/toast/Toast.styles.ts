import { cva, type VariantProps } from "class-variance-authority";

export const toastVariants = cva(
  [
    "toast"
  ],
  {
    variants: {
      vertical: {
        "top": "toast-top",
        "middle": "toast-middle",
        "bottom": "toast-bottom"
      },
      horizontal: {
        "left": "toast-left",
        "center": "toast-center",
        "right": "toast-right"
      }
    },
    defaultVariants: {
      vertical: "top",
      horizontal: "center"
    },
  }
);

export type ToastVariants = VariantProps<typeof toastVariants>;