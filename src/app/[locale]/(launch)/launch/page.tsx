import { notFound } from "next/navigation";
import { LaunchExperience } from "@/components/public/launch-experience";
import { getPublicSiteUrl } from "@/lib/public-site-url";

export default async function LaunchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "ar" && locale !== "fr") notFound();
  const launchAt = process.env.ESH_LAUNCH_AT;
  return <LaunchExperience locale={locale} launchAt={launchAt && Number.isFinite(Date.parse(launchAt)) ? launchAt : null} publicSiteUrl={getPublicSiteUrl(locale)} />;
}
