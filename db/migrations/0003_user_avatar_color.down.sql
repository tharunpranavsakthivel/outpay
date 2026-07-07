-- Rolls back the user initials-avatar color column.

alter table user_profiles
  drop column if exists avatar_color;
