-- Allow multiple parent accounts to share a contact phone number.
-- Phone numbers are contact details, not unique account identifiers.
alter table public.parent_accounts
  drop constraint if exists parent_account_school_phone_unique;
