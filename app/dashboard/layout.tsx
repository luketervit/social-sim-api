import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/*
        Hide the marketing header on the dashboard surface — the workspace
        has its own sidebar and shouldn't share chrome with the homepage.
      */}
      <style>{`
        .header { display: none !important; }
        main { padding: 0 !important; }
      `}</style>
      {children}
    </>
  );
}
