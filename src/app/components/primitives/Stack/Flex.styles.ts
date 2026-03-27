import { cva, type VariantProps } from "class-variance-authority";

export const flexVariants = cva(["flex"], {
  variants: {
    direction: {
      col: "flex-col",
      row: "flex-row"
    },
    gap: {
      none: "gap-0",
      xs: "gap-2",    
      sm: "gap-3",    
      md: "gap-4",    
      lg: "gap-6",    
      xl: "gap-8",    
      "2xl": "gap-12", 
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    },
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
    },
    reverse: {
      true: "",
      false: ""
    }
  },
  compoundVariants: [{
    reverse: true,
    direction: "row",
    class: "flex-row-reverse"
  }, 
  {
    reverse: true,
    direction: "col",
    class: "flex-col-reverse"
  }],
  defaultVariants: {
    direction: "row",
    gap: "md",
    align: "stretch",
    justify: "start",
    reverse: false
  },
});

export type FlexVariants = VariantProps<typeof flexVariants>;
