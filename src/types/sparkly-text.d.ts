declare module "@stefanjudis/sparkly-text";

declare namespace JSX {
  interface IntrinsicElements {
    "sparkly-text": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        "number-of-sparkles"?: number;
        class?: string;
      },
      HTMLElement
    >;
  }
}
