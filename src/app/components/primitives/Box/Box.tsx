import { splitProps } from "solid-js";
import { boxVariants } from "./Box.styles";
import { BoxProps } from "./Box.types";
import { Dynamic } from "solid-js/web";
import { cn } from "@/utils";

export default function Box(props: BoxProps) {
  const [local, others] = splitProps(props, [
    "as",
    "ref",
    "display",
    "position",
    "children",
    "class",
  ]);

  return (
    <Dynamic
      component={local.as || "div"}
      ref={local.ref}
      class={cn(
        boxVariants({
          display: local.display,
          position: local.position,
          class: local.class,
        }),
      )}
      {...others}
    >
      {local.children}
    </Dynamic>
  );
}
