"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * SparklyText — wraps children in a <sparkly-text> custom element
 * from @stefanjudis/sparkly-text. The web component adds animated
 * sparkles around the text content.
 */
export default function SparklyText({
  numberOfSparkles = 5,
  color = "#f9ca24",
  className,
  children,
}: {
  numberOfSparkles?: number;
  color?: string;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    // Dynamically import the web component (client-side only)
    import("@stefanjudis/sparkly-text").catch(() => {
      // Silently degrade if the package isn't available
    });
  }, []);

  // Custom element — cast to avoid JSX IntrinsicElements issues
  const SparklyTag = "sparkly-text" as unknown as React.ElementType;
  return (
    <SparklyTag
      number-of-sparkles={numberOfSparkles}
      className={className}
      style={{ "--sparkly-text-color": color } as React.CSSProperties}
    >
      {children}
    </SparklyTag>
  );
}
