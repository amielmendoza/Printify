/* ============================================================================
   Printify — SQL Server schema (T-SQL)
   Recreates the former Supabase/Postgres structure, adapted for SQL Server.

   Differences from the Postgres original (intentional):
     - uuid PKs            -> NVARCHAR(36) (app generates UUIDs; DB default NEWID())
     - jsonb columns       -> NVARCHAR(MAX) holding a JSON string
     - timestamptz         -> DATETIME2 (UTC)
     - boolean             -> BIT
     - auth.users          -> a local [users] table (Supabase Auth is replaced)
     - Row Level Security  -> enforced in application code (no RLS here)

   Safe to re-run: drops existing objects first, in dependency order.
   ========================================================================== */

SET XACT_ABORT ON;
GO

/* ---- Drop (child -> parent) -------------------------------------------- */
IF OBJECT_ID('dbo.print_logs', 'U')    IS NOT NULL DROP TABLE dbo.print_logs;
IF OBJECT_ID('dbo.id_cards', 'U')      IS NOT NULL DROP TABLE dbo.id_cards;
IF OBJECT_ID('dbo.persons', 'U')       IS NOT NULL DROP TABLE dbo.persons;
IF OBJECT_ID('dbo.templates', 'U')     IS NOT NULL DROP TABLE dbo.templates;
IF OBJECT_ID('dbo.profiles', 'U')      IS NOT NULL DROP TABLE dbo.profiles;
IF OBJECT_ID('dbo.organizations', 'U') IS NOT NULL DROP TABLE dbo.organizations;
IF OBJECT_ID('dbo.users', 'U')         IS NOT NULL DROP TABLE dbo.users;
GO

/* ---- USERS (replaces Supabase auth.users) ------------------------------ */
CREATE TABLE dbo.users (
    id                NVARCHAR(36)  NOT NULL CONSTRAINT PK_users PRIMARY KEY
                                    CONSTRAINT DF_users_id DEFAULT (LOWER(CONVERT(NVARCHAR(36), NEWID()))),
    email             NVARCHAR(320) NOT NULL,
    password_hash     NVARCHAR(255) NULL,
    external_user_id  NVARCHAR(64)  NULL,
    external_username NVARCHAR(255) NULL,
    created_at        DATETIME2     NOT NULL CONSTRAINT DF_users_created DEFAULT (SYSUTCDATETIME()),
    updated_at        DATETIME2     NOT NULL CONSTRAINT DF_users_updated DEFAULT (SYSUTCDATETIME())
);
CREATE UNIQUE INDEX UX_users_email ON dbo.users (email);
GO

/* ---- ORGANIZATIONS ----------------------------------------------------- */
CREATE TABLE dbo.organizations (
    id         NVARCHAR(36)   NOT NULL CONSTRAINT PK_organizations PRIMARY KEY
                              CONSTRAINT DF_org_id DEFAULT (LOWER(CONVERT(NVARCHAR(36), NEWID()))),
    name       NVARCHAR(255)  NOT NULL,
    slug       NVARCHAR(255)  NOT NULL,
    logo_url   NVARCHAR(1024) NULL,
    created_at DATETIME2      NOT NULL CONSTRAINT DF_org_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2      NOT NULL CONSTRAINT DF_org_updated DEFAULT (SYSUTCDATETIME())
);
CREATE UNIQUE INDEX UX_organizations_slug ON dbo.organizations (slug);
GO

/* ---- PROFILES (1:1 with users) ----------------------------------------- */
CREATE TABLE dbo.profiles (
    id              NVARCHAR(36) NOT NULL CONSTRAINT PK_profiles PRIMARY KEY,
    organization_id NVARCHAR(36) NULL,
    full_name       NVARCHAR(255) NULL,
    role            NVARCHAR(20) NOT NULL CONSTRAINT DF_profiles_role DEFAULT ('member')
                                 CONSTRAINT CK_profiles_role CHECK (role IN ('owner','admin','member')),
    created_at      DATETIME2    NOT NULL CONSTRAINT DF_profiles_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2    NOT NULL CONSTRAINT DF_profiles_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_profiles_user FOREIGN KEY (id)
        REFERENCES dbo.users (id) ON DELETE CASCADE,
    CONSTRAINT FK_profiles_org FOREIGN KEY (organization_id)
        REFERENCES dbo.organizations (id)   -- NO ACTION (avoids cascade cycles)
);
CREATE INDEX IX_profiles_org ON dbo.profiles (organization_id);
GO

/* ---- TEMPLATES --------------------------------------------------------- */
CREATE TABLE dbo.templates (
    id              NVARCHAR(36)   NOT NULL CONSTRAINT PK_templates PRIMARY KEY
                                   CONSTRAINT DF_tpl_id DEFAULT (LOWER(CONVERT(NVARCHAR(36), NEWID()))),
    organization_id NVARCHAR(36)   NOT NULL,
    name            NVARCHAR(255)  NOT NULL,
    description     NVARCHAR(MAX)  NULL,
    file_path       NVARCHAR(1024) NOT NULL,
    file_type       NVARCHAR(10)   NOT NULL CONSTRAINT CK_tpl_filetype CHECK (file_type IN ('pdf','image')),
    width_inches    FLOAT          NOT NULL CONSTRAINT DF_tpl_w DEFAULT (3.375),
    height_inches   FLOAT          NOT NULL CONSTRAINT DF_tpl_h DEFAULT (2.125),
    placeholders    NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_tpl_ph DEFAULT ('[]'),   -- JSON array
    is_active       BIT            NOT NULL CONSTRAINT DF_tpl_active DEFAULT (1),
    created_at      DATETIME2      NOT NULL CONSTRAINT DF_tpl_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2      NOT NULL CONSTRAINT DF_tpl_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_templates_org FOREIGN KEY (organization_id)
        REFERENCES dbo.organizations (id) ON DELETE CASCADE
);
CREATE INDEX IX_templates_org ON dbo.templates (organization_id);
GO

/* ---- PERSONS ----------------------------------------------------------- */
CREATE TABLE dbo.persons (
    id              NVARCHAR(36)   NOT NULL CONSTRAINT PK_persons PRIMARY KEY
                                   CONSTRAINT DF_per_id DEFAULT (LOWER(CONVERT(NVARCHAR(36), NEWID()))),
    organization_id NVARCHAR(36)   NOT NULL,
    first_name      NVARCHAR(255)  NOT NULL,
    last_name       NVARCHAR(255)  NOT NULL,
    middle_name     NVARCHAR(255)  NULL,
    photo_path      NVARCHAR(1024) NULL,
    person_type     NVARCHAR(20)   NOT NULL CONSTRAINT DF_per_type DEFAULT ('student')
                                   CONSTRAINT CK_per_type CHECK (person_type IN ('student','faculty','staff','visitor','other')),
    category        NVARCHAR(255)  NULL,
    id_number       NVARCHAR(255)  NULL,
    email           NVARCHAR(320)  NULL,
    phone           NVARCHAR(64)   NULL,
    metadata        NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_per_meta DEFAULT ('{}'),   -- JSON object
    is_active       BIT            NOT NULL CONSTRAINT DF_per_active DEFAULT (1),
    created_at      DATETIME2      NOT NULL CONSTRAINT DF_per_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2      NOT NULL CONSTRAINT DF_per_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_persons_org FOREIGN KEY (organization_id)
        REFERENCES dbo.organizations (id) ON DELETE CASCADE
);
CREATE INDEX IX_persons_org  ON dbo.persons (organization_id);
CREATE INDEX IX_persons_type ON dbo.persons (person_type);
CREATE INDEX IX_persons_name ON dbo.persons (last_name, first_name);
GO

/* ---- ID_CARDS ---------------------------------------------------------- */
CREATE TABLE dbo.id_cards (
    id                NVARCHAR(36)   NOT NULL CONSTRAINT PK_id_cards PRIMARY KEY
                                     CONSTRAINT DF_card_id DEFAULT (LOWER(CONVERT(NVARCHAR(36), NEWID()))),
    organization_id   NVARCHAR(36)   NOT NULL,
    person_id         NVARCHAR(36)   NOT NULL,
    template_id       NVARCHAR(36)   NOT NULL,
    render_state      NVARCHAR(MAX)  NULL,   -- JSON object
    exported_pdf_path NVARCHAR(1024) NULL,
    status            NVARCHAR(20)   NOT NULL CONSTRAINT DF_card_status DEFAULT ('draft')
                                     CONSTRAINT CK_card_status CHECK (status IN ('draft','generated','printed')),
    valid_from        DATE           NULL,
    valid_until       DATE           NULL,
    created_at        DATETIME2      NOT NULL CONSTRAINT DF_card_created DEFAULT (SYSUTCDATETIME()),
    updated_at        DATETIME2      NOT NULL CONSTRAINT DF_card_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_idcards_org FOREIGN KEY (organization_id)
        REFERENCES dbo.organizations (id) ON DELETE CASCADE,
    CONSTRAINT FK_idcards_person FOREIGN KEY (person_id)
        REFERENCES dbo.persons (id),        -- NO ACTION (avoids multiple cascade paths)
    CONSTRAINT FK_idcards_template FOREIGN KEY (template_id)
        REFERENCES dbo.templates (id)       -- NO ACTION
);
CREATE INDEX IX_idcards_org      ON dbo.id_cards (organization_id);
CREATE INDEX IX_idcards_person   ON dbo.id_cards (person_id);
CREATE INDEX IX_idcards_template ON dbo.id_cards (template_id);
GO

/* ---- PRINT_LOGS -------------------------------------------------------- */
/* Persons originate from an external API, so logs reference them by text id.
   template_id is a plain column (no FK), matching the Prisma model.          */
CREATE TABLE dbo.print_logs (
    id                 NVARCHAR(36)  NOT NULL CONSTRAINT PK_print_logs PRIMARY KEY
                                     CONSTRAINT DF_log_id DEFAULT (LOWER(CONVERT(NVARCHAR(36), NEWID()))),
    organization_id    NVARCHAR(36)  NULL,
    person_external_id NVARCHAR(255) NOT NULL,
    person_name        NVARCHAR(512) NOT NULL,
    template_id        NVARCHAR(36)  NULL,
    template_name      NVARCHAR(255) NULL,
    action             NVARCHAR(20)  NOT NULL CONSTRAINT CK_log_action CHECK (action IN ('printed','exported')),
    created_at         DATETIME2     NOT NULL CONSTRAINT DF_log_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_printlogs_org FOREIGN KEY (organization_id)
        REFERENCES dbo.organizations (id) ON DELETE CASCADE
);
CREATE INDEX IX_printlogs_org     ON dbo.print_logs (organization_id);
CREATE INDEX IX_printlogs_created ON dbo.print_logs (created_at DESC);
GO

/* ============================================================================
   SEED DATA — initial organization + owner account
   ----------------------------------------------------------------------------
   Lets you log in immediately via /login (local credentials path):
       Username (email): admin@printify.local
       Password:         Printify123!
   The password_hash below is bcrypt (cost 10) of that password. CHANGE IT in
   production: log in, then either reset via the app or replace the hash here.
   ========================================================================== */

DECLARE @orgId  NVARCHAR(36) = '00000000-0000-0000-0000-000000000001';
DECLARE @userId NVARCHAR(36) = '00000000-0000-0000-0000-000000000010';

INSERT INTO dbo.organizations (id, name, slug)
VALUES (@orgId, 'Printify', 'printify');

INSERT INTO dbo.users (id, email, password_hash)
VALUES (@userId, 'admin@printify.local', '$2b$10$Wzr93vABbWBQ6y6t65FPRectsrkqNM2qQWoWJJypToYFSDpUXJFca');

INSERT INTO dbo.profiles (id, organization_id, full_name, role)
VALUES (@userId, @orgId, 'Administrator', 'owner');
GO

PRINT 'Printify schema created and seeded successfully.';
PRINT 'Login: admin@printify.local / Printify123!';
GO
