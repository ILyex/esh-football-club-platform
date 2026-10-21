import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

type PlayerRow = {
  licence: string; first: string; last: string; firstFr: string; lastFr: string;
  dob: string; number: number; team: "SENIOR" | "U20"; photo: string;
};
type StaffRow = {
  licence: string; first: string; last: string; firstFr: string; lastFr: string;
  role: "HEAD_COACH" | "ASSISTANT_COACH" | "ADMINISTRATIVE_STAFF"; team: "SENIOR" | "U20" | "U17" | "U15" | null;
};

const p = (licence: string, first: string, last: string, firstFr: string, lastFr: string, dob: string, number: number, team: PlayerRow["team"], photo: string): PlayerRow => ({ licence, first, last, firstFr, lastFr, dob, number, team, photo });
const s = (licence: string, first: string, last: string, firstFr: string, lastFr: string, role: StaffRow["role"], team: StaffRow["team"]): StaffRow => ({ licence, first, last, firstFr, lastFr, role, team });

const players: PlayerRow[] = [
  p("26W14J0327", "ساكت", "معاذ بالله", "SAKET", "MOUATEZ BIELLAH", "1996-10-05", 5, "SENIOR", "/roster/senior-01.jpg"),
  p("26W14J0357", "طهري", "إلياس", "TAHRI", "ILIES", "1999-12-19", 20, "SENIOR", "/roster/senior-02.jpg"),
  p("26W14J0354", "زرقان", "ميلود", "ZERKANE", "MILOUD", "1989-12-29", 11, "SENIOR", "/roster/senior-03.jpg"),
  p("26W14J0355", "شعاب", "علي", "CHABAL", "ALI", "1996-10-26", 6, "SENIOR", "/roster/senior-04.jpg"),
  p("26W14J0334", "عمارة", "سيف الإسلام وائل", "AMARA", "SEIF EL ISLAM WAIL", "2004-02-10", 17, "SENIOR", "/roster/senior-05.jpg"),
  p("26W14J0724", "جلولي", "إبراهيم", "DJELLOULI", "IBRAHIM", "2006-06-14", 15, "SENIOR", "/roster/senior-06.jpg"),
  p("26W14J0723", "ضرار", "بوعبد الله", "DERRAR", "BOUABDELLAH", "1994-10-05", 7, "SENIOR", "/roster/senior-07.jpg"),
  p("26W14J0330", "مداني", "إلياس", "MADANI", "ILIES", "1999-01-27", 14, "SENIOR", "/roster/senior-08.jpg"),
  p("26W14J0328", "بدوي", "أيوب", "BEDOUI", "AYOUB", "2005-04-03", 30, "SENIOR", "/roster/senior-09.jpg"),
  p("26W14J0326", "زغيدة", "نور الدين", "ZEGHIDA", "NOUREDDINE", "1988-12-28", 1, "SENIOR", "/roster/senior-10.jpg"),
  p("26W14J0325", "دياب", "ياسر الدين إسماعيل", "DIAB", "YASSER EDDINE ISMAIL", "1998-04-08", 12, "SENIOR", "/roster/senior-11.jpg"),
  p("26W14J0324", "بن صحراوي", "جمال الدين", "BENSAHRAOUI", "DJAMAL EDDINE", "1990-12-17", 10, "SENIOR", "/roster/senior-12.jpg"),
  p("26W14J0323", "سايس", "عبادي", "SAIS", "ABADI", "1997-06-14", 2, "SENIOR", "/roster/senior-13.jpg"),
  p("26W14J0322", "عماري", "لحسن", "AMMARI", "LAHCENE", "1997-04-03", 3, "SENIOR", "/roster/senior-14.jpg"),
  p("26W14J0321", "بومعزة", "أحمد", "BOUMAAZA", "AHMED", "1996-04-20", 9, "SENIOR", "/roster/senior-15.jpg"),
  p("26W14J0320", "عتافتة", "سيد أحمد", "ATTAFTA", "SID AHMED", "1997-11-15", 8, "SENIOR", "/roster/senior-16.jpg"),
  p("26W14J0319", "عواد", "محمد صلاح", "AOUED", "MOHAMED SALAH", "2003-10-08", 4, "SENIOR", "/roster/senior-17.jpg"),
  p("26W14J0305", "فرحات", "محمد إسلام", "FERHAT", "MOHAMED ISLAM", "2006-01-01", 19, "SENIOR", "/roster/senior-18.jpg"),
  p("26W14J0686", "أنديش", "لحسن أمين", "ANDICHE", "LAHCEN AMINE", "2009-09-23", 0, "U20", "/roster/senior-19.jpg"),
  p("26W14J0735", "بوشكور", "خالد", "BOUCHAKOUR", "KHALED", "2009-06-15", 0, "U20", "/roster/senior-20.jpg"),
  p("26W14J0726", "بوزكرير", "عبد الباسط", "BOUZEKRIR", "ABDELBASSET", "2008-03-30", 0, "U20", "/roster/u20-01.jpg"),
  p("26W14J0727", "حمزة", "عبد الجليل", "HAMZA", "ABDELJALIL", "2009-08-19", 0, "U20", "/roster/u20-02.jpg"),
  p("26W14J0728", "عدة", "محمد أمين", "ADDA", "MOHAMED AMINE", "2009-08-04", 0, "U20", "/roster/u20-03.jpg"),
  p("26W14J0730", "شنان", "أسامة عبد الرؤوف", "CHENANE", "OUSSAMA ABDERAOUF", "2009-01-03", 0, "U20", "/roster/u20-04.jpg"),
  p("26W14J0731", "رزقي", "أحمد", "REZKI", "AHMED", "2009-05-10", 0, "U20", "/roster/u20-05.jpg"),
  p("26W14J0732", "صاسفة", "صفاء محمد", "SASEFA", "SAFA MOHAMED", "2009-01-06", 0, "U20", "/roster/u20-06.jpg"),
  p("26W14J0733", "بنجدو", "محمد", "BENDJEDDOU", "MOHAMED", "2009-11-27", 0, "U20", "/roster/u20-07.jpg"),
  p("26W14J0734", "منا", "محمد كامل", "MENAA", "MOHAMED KAMEL", "2009-11-05", 0, "U20", "/roster/u20-08.jpg"),
  p("26W14J0300", "بوخروص", "أمير بلقاسم", "BOUKHOURS", "AMEUR BELKACEM", "2008-02-23", 0, "U20", "/roster/u20-09.jpg"),
  p("26W14J0684", "بورداش", "عبد الصمد", "BOURDAS", "ABDESSAMAD", "2008-03-21", 0, "U20", "/roster/u20-10.jpg"),
  p("26W14J0683", "بلال", "أنس", "BELLAL", "ANES", "2008-11-19", 0, "U20", "/roster/u20-11.jpg"),
  p("26W14J0652", "بورداش", "عبد الإله", "BOURDAS", "ABDELLILAH", "2007-07-04", 0, "U20", "/roster/u20-12.jpg"),
  p("26W14J0650", "سعد", "محمد الطاهر", "SAAD", "MOHAMED TAHAR", "2009-01-05", 0, "U20", "/roster/u20-13.jpg"),
  p("26W14J0338", "لروسي", "أمجد عبد الجليل", "LARROUSSI", "AMDJAD ABDELDJALIL", "2009-02-12", 0, "U20", "/roster/u20-14.jpg"),
  p("26W14J0337", "بلزروقي", "رباح", "BELZERROUGUI", "RABAH", "2009-06-10", 0, "U20", "/roster/u20-15.jpg"),
  p("26W14J0336", "دحمان", "أحمد", "DAHAMANE", "AHMED", "2007-10-18", 0, "U20", "/roster/u20-16.jpg"),
  p("26W14J0335", "مهدي", "عابد عبد الوهاب", "MEHDI ABED", "ABDELWAHAB", "2009-03-30", 0, "U20", "/roster/u20-17.jpg"),
  p("26W14J0649", "بوعمامة", "محمد يونس", "BOUMAAZA", "MOHAMED YOUNES", "2009-06-18", 0, "U20", "/roster/u20-18.jpg"),
  p("26W14J0333", "مختاري", "محمد", "MOKHTARI", "MOHAMED", "2007-10-20", 0, "U20", "/roster/u20-19.jpg"),
  p("26W14J0332", "لروسي", "محمد أيوب", "LARROUSSI", "MOHAMED AYOUB", "2008-10-18", 0, "U20", "/roster/u20-20.jpg"),
  p("26W14J0331", "سايس", "أحمد", "SAIS", "AHMED", "2007-02-18", 0, "U20", "/roster/u20-21.jpg")
];

const staff: StaffRow[] = [
  s("26W14E0014", "العربي", "أبو بكر الصديق", "LARABI", "ABOU BAKR ESSEDIK", "HEAD_COACH", "SENIOR"),
  s("26W14E0029", "التحفة", "سيد أحمد", "ATTAHFA", "SID AHMED", "HEAD_COACH", "U17"),
  s("26W14E0030", "دباح", "عبد الكريم", "DEBBAH", "ABDELKARIM", "HEAD_COACH", "U20"),
  s("26W14E0031", "بوعالم", "أحمد بدر الدين", "BOUALEM", "AHMED BEDREDDINE", "ASSISTANT_COACH", "SENIOR"),
  s("26W14E0032", "بن صحراوي", "بن عبد الله", "BENSAHRAOUI", "BENABDELLAH", "HEAD_COACH", "U15"),
  s("26W14D0014", "أرقوب", "سفيان", "ARGOU B", "SOFIANE", "ADMINISTRATIVE_STAFF", null)
];

function dateOnly(value: string) { return new Date(`${value}T00:00:00.000Z`); }
async function teamId(category: string) {
  return (await db.team.findUnique({ where: { category: category as any }, select: { id: true } }))?.id ?? null;
}
async function uniqueSlug(first: string, last: string, licence: string) {
  const base = slugify(`${first}-${last}-${licence}`) || `player-${licence.toLowerCase()}`;
  return base;
}

async function main() {
  const teams = Object.fromEntries(await Promise.all(["SENIOR", "U20", "U17", "U15"].map(async (c) => [c, await teamId(c)])));
  const missing = Object.entries(teams).filter(([, id]) => !id).map(([c]) => c);
  if (missing.length) throw new Error(`Missing team categories: ${missing.join(", ")}`);
  for (const row of players) {
    const existing = await db.player.findFirst({ where: { licenceNumber: row.licence }, select: { id: true, slug: true, photoUrl: true } });
    const data = {
      firstName: row.first, lastName: row.last, firstNameFr: row.firstFr, lastNameFr: row.lastFr,
      dateOfBirth: dateOnly(row.dob), position: "MIDFIELDER" as const, nationality: "الجزائر",
      shirtNumber: row.number > 0 ? row.number : null, licenceNumber: row.licence,
      teamId: teams[row.team], status: "ACTIVE" as const, photoUrl: existing?.photoUrl || row.photo
    };
    if (existing) await db.player.update({ where: { id: existing.id }, data });
    else await db.player.create({ data: { ...data, slug: await uniqueSlug(row.first, row.last, row.licence) } });
  }
  for (const row of staff) {
    const existing = await db.staff.findFirst({ where: { licenceNumber: row.licence }, select: { id: true } });
    const data = { firstName: row.first, lastName: row.last, firstNameFr: row.firstFr, lastNameFr: row.lastFr, role: row.role, status: "ACTIVE" as const, licenceNumber: row.licence, teamId: row.team ? teams[row.team] : null };
    if (existing) await db.staff.update({ where: { id: existing.id }, data });
    else await db.staff.create({ data });
  }
  console.log(`Roster imported: ${players.length} players and ${staff.length} staff.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
