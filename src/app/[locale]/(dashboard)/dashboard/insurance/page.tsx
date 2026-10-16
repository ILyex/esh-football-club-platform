import { redirect } from "next/navigation";

/** Keep previously saved bookmarks working after the insurance module became the player medical file. */
export default async function LegacyInsuranceRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/medical-records`);
}
