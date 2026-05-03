import { redirect } from "next/navigation";

export default async function LegacyEmployeeRedirect({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  redirect(`/people/${encodeURIComponent(key)}`);
}
