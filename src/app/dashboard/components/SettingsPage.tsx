"use client";

import ConnectionsPanel from "./ConnectionsPanel";
import RiskProfileEditor from "./RiskProfileEditor";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <ConnectionsPanel />
      <RiskProfileEditor />
    </div>
  );
}
