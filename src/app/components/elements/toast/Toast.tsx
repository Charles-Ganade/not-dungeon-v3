import { splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cn } from "@/utils";
import { ToastProps } from "./Toast.types";
import { toastVariants } from "./Toast.styles";

export function Toast(props: ToastProps) {
  const [local, others] = splitProps(props, [
    "as",
    "ref",
    "children",
    "class",
    "vertical",
    "horizontal",
  ]);

  return (
    <Dynamic
      component={local.as || "div"}
      ref={local.ref}
      class={cn(
        toastVariants({
          vertical: local.vertical,
          horizontal: local.horizontal,
          class: local.class,
        }),
      )}
      {...others}
    >
      {local.children}
    </Dynamic>
  );
}
