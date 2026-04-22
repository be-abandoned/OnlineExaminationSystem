import { Outlet } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";
import SideNav, { type NavItem } from "@/components/layout/SideNav";

export default function AppShell({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <TopNav title={title} />
      <div className="mx-auto flex flex-col md:flex-row gap-4 px-4 pb-8 pt-4 w-full">
        <aside className="w-full md:w-64 flex-shrink-0">
          <SideNav items={items} />
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

