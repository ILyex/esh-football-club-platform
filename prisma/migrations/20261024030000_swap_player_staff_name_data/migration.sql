-- Existing player and staff records have first/last name values reversed.
-- Correct the stored values in place without changing the form fields or schema.
BEGIN;

UPDATE "Player"
SET "firstName" = "lastName",
    "lastName" = "firstName",
    "firstNameFr" = "lastNameFr",
    "lastNameFr" = "firstNameFr";

UPDATE "Staff"
SET "firstName" = "lastName",
    "lastName" = "firstName",
    "firstNameFr" = "lastNameFr",
    "lastNameFr" = "firstNameFr";

COMMIT;
