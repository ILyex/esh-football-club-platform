"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { clubSettingsSchema } from "@/lib/validations/settings";
import { writeAuditLog } from "@/lib/audit";
import { validateUploadedImage, generatePublicStorageKey, uploadPublicFile } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";

export async function updateClubSettingsAction(formData: FormData, locale: string) {
  const user = await requirePermission("settings.manage");
  const before = await db.clubSettings.findUniqueOrThrow({ where: { id: "singleton" } });

  const raw = Object.fromEntries(formData.entries());
  const parsed = clubSettingsSchema.parse(raw);

  // The official logo is an uploaded asset, never generated — this branch
  // only ever runs when the admin actually selects a new file. If none is
  // selected, logoUrl is left exactly as it was (see spec: "do NOT invent
  // or generate a replacement logo").
  let logoUrl: string | undefined;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const { mime, ext } = await validateUploadedImage(buffer);
    const key = generatePublicStorageKey("branding", ext);
    logoUrl = await uploadPublicFile({ key, buffer, mimeType: mime });
  }

  const settings = await db.clubSettings.update({
    where: { id: "singleton" },
    data: {
      name: parsed.name,
      shortName: parsed.shortName,
      description: parsed.description,
      stadium: parsed.stadium,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone,
      address: parsed.address,
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor,
      defaultLocale: parsed.defaultLocale,
      ...(logoUrl ? { logoUrl } : {})
    }
  });

  await writeAuditLog({
    userId: user.id,
    action: "settings.update",
    entityType: "ClubSettings",
    entityId: settings.id,
    changes: { before, after: { ...parsed, logoChanged: Boolean(logoUrl) } }
  });

  // Branding touches nearly every page (public site header/footer, dashboard
  // sidebar, generated documents later) — revalidate broadly.
  // The footer reads contact details through the public locale layout.
  // Revalidate both supported locale roots so saved settings appear on every
  // public page regardless of which language the visitor uses.
  revalidatePath("/ar", "layout");
  revalidatePath("/fr", "layout");
  revalidateTag("public-club-settings");
  revalidateTag("public-home");
  revalidatePath(`/${locale}/dashboard/settings`);
  return { id: settings.id };
}
