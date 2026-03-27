import { splitProps } from "solid-js";
import { TextProps } from "./Text.types";
import { Dynamic } from "solid-js/web";
import { cn } from "../../../utils";
import { textVariants } from "./Text.styles";

export default function Text(props: TextProps) {
  const [local, others] = splitProps(props, [
    "as",
    "ref",
    "children",
    "variant",
    "color",
    "align",
    "weight",
    "truncate",
    "clamp",
    "class",
  ]);

  const defaultElement = () => {
    switch (local.variant) {
      case "display":
      case "h1":
        return "h1";
      case "h2":
        return "h2";
      case "h3":
        return "h3";
      case "h4":
        return "h4";
      case "h5":
        return "h5";
      case "h6":
        return "h6";
      case "caption":
        return "span";
      default:
        return "p";
    }
  };

  return (
    <Dynamic
      component={local.as || defaultElement()}
      class={cn(
        textVariants({
          variant: local.variant,
          color: local.color,
          align: local.align,
          weight: local.weight,
          truncate: local.truncate,
          clamp: local.clamp,
          class: local.class,
        }),
      )}
      {...others}
    >
      {local.children}
    </Dynamic>
  );
}
