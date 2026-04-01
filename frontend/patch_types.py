import re

with open('src/lib/types.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''export type Me = {
  tg_id: number;
  tg_name: string;
  tg_avatar: string | null;
  custom_name: string | null;
  custom_avatar: string | null;
  is_admin: boolean;
};'''

replacement = '''export type Me = {
  tg_id: number;
  tg_name: string;
  tg_avatar: string | null;
  custom_name: string | null;
  custom_avatar: string | null;
  is_admin: boolean;
  default_context_id?: number | null;
};'''

text = text.replace(target, replacement)
text = text.replace(target.replace('\\n', '\\r\\n'), replacement.replace('\\n', '\\r\\n'))

with open('src/lib/types.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print("types.ts patched!")
