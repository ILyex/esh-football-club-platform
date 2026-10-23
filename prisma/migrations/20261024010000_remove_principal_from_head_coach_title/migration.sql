-- Keep existing staff-linked user cards aligned with the current head coach title.
UPDATE "User"
SET "licenseRole" = regexp_replace("licenseRole", '^Entraîneur principal(?= —|$)', 'Entraîneur')
WHERE "licenseRole" LIKE 'Entraîneur principal%';
