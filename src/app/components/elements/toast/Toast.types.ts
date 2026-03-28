import { JSX } from "solid-js";
import { ToastVariants } from "./Toast.styles";

export interface ToastProps extends JSX.HTMLAttributes<HTMLDivElement>, ToastVariants {
  as?: keyof JSX.IntrinsicElements;
  children?: JSX.Element;
}

export type { ToastVariants };