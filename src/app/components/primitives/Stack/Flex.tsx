import { splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { FlexProps } from "./Flex.types";
import { flexVariants } from "./Flex.styles";
import { cn } from "@/utils";

export default function Flex(props: FlexProps) {
  const [local, others] = splitProps(props, [
    "as",
    "ref",
    "children",
    "gap",
    "align",
    "justify",
    "class",
    "direction",
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
          direction: local.direction,
          class: local.class,
        }),
      )}
      {...others}
    >
      {local.children}
    </Dynamic>
  );
}
