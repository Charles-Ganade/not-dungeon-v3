import { cva, type VariantProps } from "class-variance-authority";

export const textVariants = cva("", {
  variants: {
    color: {
      inherit: "text-inherit",
      base: "text-base-content",
      muted: "text-base-content/60",
      subtle: "text-base-content/40",
      primary: "text-primary",
      secondary: "text-secondary",
      accent: "text-accent",
      info: "text-info",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      link: "link link-primary",
    },

    variant: {
      display: "text-5xl font-bold leading-tight",
      h1: "text-4xl font-bold leading-tight",
      h2: "text-3xl font-semibold leading-snug",
      h3: "text-2xl font-semibold leading-snug",
      h4: "text-xl font-medium leading-snug",
      h5: "text-lg font-medium",
      h6: "text-base font-medium",

      body: "text-base",
      bodySm: "text-sm",
      caption: "text-xs",
      overline: "text-xs uppercase tracking-wide",
    },

    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    },

    weight: {
      light: "font-light",
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },

    truncate: {
      true: "truncate",
      false: null,
    },

    clamp: {
      none: null,
      1: "line-clamp-1",
      2: "line-clamp-2",
      3: "line-clamp-3",
      4: "line-clamp-4",
      5: "line-clamp-5",
      6: "line-clamp-6",
    },
  },

  compoundVariants: [
    // If truncate is enabled, neutralize clamp
    {
      truncate: true,
      clamp: 1,
      class: "truncate line-clamp-none",
    },
  ],

  defaultVariants: {
    color: "inherit",
    variant: "body",
    align: "left",
    weight: "normal",
    truncate: false,
    clamp: "none",
  },
});

export type TextVariants = VariantProps<typeof textVariants>;