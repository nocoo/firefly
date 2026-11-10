"use client";

import type { ReactElement } from "react";
import { LinkButton } from "@nocoo/basalt/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@nocoo/basalt/components/tooltip";

export function HeaderTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function HexlyLink({ className }: { className?: string } = {}) {
  return (
    <HeaderTooltip label="Firefly on hexly.ai">
      <LinkButton
        variant="ghost"
        size="icon"
        href="https://hexly.ai/projects/firefly"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Firefly on hexly.ai (opens in a new tab)"
        className={`${className ?? "w-8 rounded-basalt-md text-basalt-muted-foreground hover:text-basalt-foreground"} [&_svg]:size-[1.125rem]`}
      >
        <span className="sr-only">Firefly on hexly.ai (opens in a new tab)</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 2 8.66 5v10L12 22l-8.66-5V7Z" />
          <path d="M12 2v20M3.34 7l17.32 10m0-10L3.34 17" />
        </svg>
      </LinkButton>
    </HeaderTooltip>
  );
}
