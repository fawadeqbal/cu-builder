"use client";

import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { Dashboard } from "./Dashboard";

export function DashboardPage() {
  return (
    <RequireAuth>
      {(me) => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <Dashboard me={me} />
        </div>
      )}
    </RequireAuth>
  );
}
