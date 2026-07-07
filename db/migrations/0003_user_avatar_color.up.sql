-- Adds a user-chosen background color for the initials avatar shown in the
-- dashboard sidebar and marketing navbar (no profile picture uploads).

alter table user_profiles
  add column avatar_color text;
