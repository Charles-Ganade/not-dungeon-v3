import { splitProps } from "solid-js";
import { cn } from "../../../utils";
import { Dynamic } from "solid-js/web";
import { FlexProps } from "./Flex.types";
import { flexVariants } from "./Flex.styles";

export default function Flex(props: FlexProps) {
  const [local, others] = splitProps(props, [
    "as",
    "ref",
    "children",
    "gap",
    "align",
    "justify",
    "class",
  ]);

  return (
    <Dynamic
      component={local.as || "div"}
      ref={local.ref}
      class={cn(
        flexVariants({
          gap: local.gap,
          align: local.align,
          justify: local.justify,
          class: local.class,
        }),
      )}
      {...others}
    >
      {local.children}
    </Dynamic>
  );
}
