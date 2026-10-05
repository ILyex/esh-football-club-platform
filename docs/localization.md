# Arabic and French Language Guide

Keep the Arabic and French message files structurally identical. Add a key to
both `src/i18n/messages/ar.json` and `src/i18n/messages/fr.json` in the same
change. Use `npm run i18n:check` to find missing keys and mismatched
interpolation variables.

## Preferred terminology

| Meaning | Arabic | French |
|---|---|---|
| Club teams by age | الفئات | Catégories |
| Senior team | الأكابر | Seniors |
| Under-20 team | أواسط (U20) | U20 |
| Under-17 team | أشبال (U17) | U17 |
| Under-15 team | أصاغر (U15) | U15 |
| Match | مباراة | Match |
| Fixture schedule | رزنامة المباريات | Calendrier des matchs |
| Training session | حصة تدريبية | Séance d'entraînement |
| Players | اللاعبون | Joueurs |
| Staff | الطاقم | Staff |
| Documents | الوثائق | Documents |
| Finance | المالية | Finances |
| Budget | الميزانية | Budget |
| Expense | مصروف | Dépense |
| Treasury | الخزينة | Trésorerie |
| Audit log | سجل العمليات | Journal d'audit |

Use the preferred form for navigation, page headings, filters, empty states,
status labels and notifications. Keep acronyms and player/team names unchanged.
Use sentence case for French headings and avoid mixing English terms into
Arabic labels unless the term is a recognized competition or age-category
acronym.

## Writing rules

- Keep labels concise and use the same word for the same action across pages.
- Use explicit Arabic hamza and ta marbuta; avoid unnecessary transliteration.
- Use French accents and standard football vocabulary.
- Keep format variables identical in both locales, for example `{count}`.
- Do not build visible copy by joining translated fragments; translate the
  complete sentence so Arabic word order remains natural.
- For UI additions, prefer existing `common`, `dashboard`, feature and
  `publicSite` namespaces over inline locale conditionals.
