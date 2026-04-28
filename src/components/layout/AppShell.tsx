import { Outlet } from "react-router-dom";
import TopNav from "@/components/layout/TopNav";
import SideNav, { type NavItem } from "@/components/layout/SideNav";

export default function AppShell({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <TopNav title={title} />
      <div className="mx-auto flex w-full flex-col gap-4 px-4 pb-8 pt-4 md:flex-row">
        <aside className="w-full flex-shrink-0 md:fixed md:left-4 md:top-20 md:z-10 md:max-h-[calc(100vh-6rem)] md:w-64 md:overflow-y-auto">
          <SideNav items={items} />
        </aside>
        <main className="min-w-0 flex-1 md:ml-[17rem]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
