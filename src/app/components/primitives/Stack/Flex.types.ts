import { JSX } from "solid-js";
import { FlexVariants } from "./Flex.styles";

export interface FlexProps extends JSX.HTMLAttributes<HTMLDivElement>, FlexVariants {
  as?: keyof JSX.IntrinsicElements;
  children?: JSX.Element | undefined;
}

export type { FlexVariants };