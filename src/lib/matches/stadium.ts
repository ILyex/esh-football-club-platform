export const CLUB_HOME_STADIUM = "الملعب البلدي طاهري حسني – سيدي حسني";

export function matchStadium(isHomeFixture: boolean, fafStadium?: string | null, currentStadium?: string | null): string {
  if (isHomeFixture) return CLUB_HOME_STADIUM;
  return fafStadium?.trim() || currentStadium?.trim() || "";
}
