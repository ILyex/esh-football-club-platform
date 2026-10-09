import { getPublicClubSettings } from "@/lib/public/club";
import { ClubOverviewPage } from "@/components/public/club-overview-page";

export default async function ClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const club = await getPublicClubSettings();

  return (
    <ClubOverviewPage
      locale={locale}
      phone={club.contactPhone}
      email={club.contactEmail}
    />
  );
}
