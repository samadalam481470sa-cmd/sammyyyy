import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle';
type ButtonSize = 'sm' | 'md';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-navy-900 text-white shadow-card hover:bg-navy-800 active:bg-navy-950 disabled:bg-navy-900/40',
  secondary:
    'border border-slate-200 bg-white text-navy-800 shadow-card hover:border-navy-200 hover:bg-navy-50',
  subtle: 'bg-navy-50 text-navy-800 hover:bg-navy-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-navy-900',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-9 gap-2 px-3.5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
