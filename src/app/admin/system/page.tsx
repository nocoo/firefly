import type { Metadata } from "next";
import { SystemMonitorDashboard } from "@/components/admin/system-monitor-dashboard";

export const metadata: Metadata = {
  title: "系统监控",
};

export default function SystemMonitorPage() {
  return <SystemMonitorDashboard />;
}
