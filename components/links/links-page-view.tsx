"use client";

import { StatusBarMock } from "@/components/messages/status-bar-mock";
import { ExclusiveContentStore } from "@/components/links/exclusive-content-store";

export function LinksPageView() {
  return (
    <div className="bg-[#F5F3EE] pb-6">
      <StatusBarMock />
      <ExclusiveContentStore />
    </div>
  );
}
