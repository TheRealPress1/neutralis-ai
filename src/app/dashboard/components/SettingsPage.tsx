"use client";

import ApiKeyManager from "./ApiKeyManager";
import RiskProfileEditor from "./RiskProfileEditor";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <ApiKeyManager />
      <RiskProfileEditor />
    </div>
  );
}
