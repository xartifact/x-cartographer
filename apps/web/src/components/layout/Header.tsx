"use client";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@x-cartographer/ui";
import { ThemeToggle } from "./theme-toggle";
import { ProductSwitcher } from "./product-switcher";
import { HeaderProps } from "./types";
export function Header({ logoHref = "/", logo, actions, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link to={logoHref} className="font-semibold text-lg">
          <span className="hidden sm:inline">{logo || "X-Cartographer"}</span>
          <span className="sm:hidden">XC</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {actions}
          <ProductSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
