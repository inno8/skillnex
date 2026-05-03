import { redirect } from "next/navigation";

// /settings → /settings/profile (always available to any tenant user).
export default function SettingsIndex() {
  redirect("/settings/profile");
}
