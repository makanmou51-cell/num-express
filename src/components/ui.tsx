import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none",
        "placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium", className)}
      {...props}
    />
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
  outline: "border bg-white hover:bg-gray-50 disabled:opacity-60",
  ghost: "hover:bg-gray-100 disabled:opacity-60",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
};
const SIZES = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base" };

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        VARIANTS[variant ?? "primary"],
        SIZES[size ?? "md"],
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-700 border-green-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
  }[variant];
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", styles)}>
      {children}
    </div>
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
