-- 001_create_tables.sql
--
-- The whole database: three tables and how they relate.
--
--   users  1 --- * lists  1 --- * items
--
-- A list REFERENCES its owner and an item REFERENCES its list, so the database
-- itself refuses a list with no owner or an item with no list. ON DELETE
-- CASCADE means deleting a list deletes its items with it.
--
-- The CHECK constraints are the last line of defense. The server checks the
-- same rules before it writes (see src/rules.ts), so a user sees a friendly
-- message, but if a bug ever let bad data through, the database would still
-- say no.
--
-- Migrations run in file name order, each exactly once (see src/migrate.ts).
-- Never edit one that has already run; add 002_... instead.

CREATE TABLE users (
    -- a random UUID rather than 1, 2, 3, so an id says nothing about how many
    -- users there are or which came first
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- always stored in lower case, so "Wolfie@SBU.edu" is the same account
    email              text        NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash      text        NOT NULL,
    -- the avatar image's own bytes, its type, and when it last changed
    avatar             bytea,
    avatar_type        text,
    avatar_updated_at  timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lists (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        text        NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
    -- where the list sits on its owner's home screen, lowest first
    position    integer     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- every query asks for one owner's lists, so this makes that fast
CREATE INDEX lists_owner_id_index ON lists (owner_id);

CREATE TABLE items (
    list_id       uuid    NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
    -- made by the client (i.e. item-6f1c...), so it is text, not a uuid
    id            text    NOT NULL,
    -- where the item sits in its list, from 0
    position      integer NOT NULL,
    description   text    NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 200),
    date_entered  date    NOT NULL,
    -- priority, target_date and completed are added by 002_add_item_details.sql

    -- an item id only has to be unique within its own list
    PRIMARY KEY (list_id, id),
    UNIQUE (list_id, position)
);
