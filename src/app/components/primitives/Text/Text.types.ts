import { JSX } from "solid-js";
import { TextVariants } from "./Text.styles";

export interface TextProps extends JSX.HTMLAttributes<HTMLDivElement>, TextVariants {
  as?: keyof JSX.IntrinsicElements;
  children?: JSX.Element | undefined;
}

export type { TextVariants };