import re

with open('app/routes/me.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''            "custom_name": user.custom_name,
            "custom_avatar": user.custom_avatar,
            "is_admin": is_admin(user),
        }'''

replacement = '''            "custom_name": user.custom_name,
            "custom_avatar": user.custom_avatar,
            "is_admin": is_admin(user),
            "default_context_id": user.default_context_id,
        }'''

# Handle CRLF vs LF
text = text.replace(target, replacement)
text = text.replace(target.replace('\n', '\r\n'), replacement.replace('\n', '\r\n'))

with open('app/routes/me.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("me.py updated!")
