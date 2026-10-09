import { redirect } from "next/navigation";

export default async function WebsiteManagementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/website/analytics`);
}
