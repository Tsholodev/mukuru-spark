"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[#E65300] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#E65300] text-white hover:bg-[#CF4900]",
        secondary: "bg-white text-[#241910] border border-[#E4D7CC] hover:bg-[#FFF1E8]",
        ghost: "bg-transparent text-[#241910] hover:bg-[#F3E8DF]",
        dark: "bg-[#241910] text-white hover:bg-[#3A2C24]",
      },
      size: {
        default: "h-12 px-5 text-[15px]",
        sm: "h-9 px-3 text-sm",
        lg: "h-14 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
