import { type ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

export type NavItem = {
  to?: string;
  label: string;
  icon?: ReactNode;
  children?: NavItem[];
  onMouseEnter?: () => void;
};

function NavItemRenderer({ it, depth = 0 }: { it: NavItem; depth?: number }) {
  const location = useLocation();
  const hasChildren = it.children && it.children.length > 0;
  const isActive = it.to ? location.pathname === it.to || location.pathname.startsWith(it.to + "/") : false;
  
  // Check if any child is active to auto-expand
  const isChildActive = hasChildren && it.children!.some(child => 
    child.to ? location.pathname === child.to || location.pathname.startsWith(child.to + "/") : false
  );

  const [isExpanded, setIsExpanded] = useState(isChildActive);

  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="grid gap-1">
      {it.to && !hasChildren ? (
        <NavLink
          to={it.to}
          onMouseEnter={it.onMouseEnter}
          className={({ isActive: linkActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
              linkActive ? "bg-blue-50 text-blue-700" : "text-zinc-700 hover:bg-zinc-100",
              depth > 0 && "pl-9"
            )
          }
          end
        >
          {it.icon && <span className={cn("text-zinc-500", depth === 0 ? "" : "opacity-70")}>{it.icon}</span>}
          <span className="truncate flex-1">{it.label}</span>
        </NavLink>
      ) : (
        <button
          onClick={handleClick}
          onMouseEnter={it.onMouseEnter}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition text-left",
            isActive || isChildActive ? "text-blue-700 font-medium" : "text-zinc-700 hover:bg-zinc-100",
            depth > 0 && "pl-9"
          )}
        >
          {it.icon && <span className={cn("text-zinc-500", depth === 0 ? "" : "opacity-70")}>{it.icon}</span>}
          <span className="truncate flex-1">{it.label}</span>
          {hasChildren && (
            <span className="text-zinc-400">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
        </button>
      )}
      
      {hasChildren && isExpanded && (
        <div className="grid gap-1">
          {it.children!.map((child) => (
            <NavItemRenderer key={child.label + (child.to || "")} it={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="rounded-xl border border-zinc-200 bg-white p-2">
      <div className="grid gap-1">
        {items.map((it) => (
          <NavItemRenderer key={it.label + (it.to || "")} it={it} />
        ))}
      </div>
    </nav>
  );
}
