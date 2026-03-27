import { JSX } from "solid-js";
import { BoxVariants } from "./Box.styles";

export interface BoxProps extends JSX.HTMLAttributes<HTMLDivElement>, BoxVariants {
  as?: keyof JSX.IntrinsicElements;
  children?: JSX.Element;
}

export type { BoxVariants };