import { cva, type VariantProps } from "class-variance-authority";

export const boxVariants = cva([], {
  variants: {
    display: {
      block: "block",
      inline: "inline",
      "inline-block": "inline-block",
      flex: "flex",
      "inline-flex": "inline-flex",
      grid: "grid",
    },
    position: {
      static: "static",
      relative: "relative",
      absolute: "absolute",
      fixed: "fixed",
      sticky: "sticky",
    },
  },
  defaultVariants: {
    display: "block",
    position: "static",
  },
});

export type BoxVariants = VariantProps<typeof boxVariants>;
