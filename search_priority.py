import os
import re

dir_path = r"C:\Users\vince\OneDrive\Desktop\Apollo"

for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith(('.html', '.js', '.css')):
            fp = os.path.join(root, file)
            with open(fp, 'r', encoding='utf-8') as f:
                content = f.read()
            matches = list(re.finditer(r'priority', content, re.IGNORECASE))
            if matches:
                print(f"File: {os.path.relpath(fp, dir_path)}")
                for match in matches[:5]:
                    start = max(0, match.start() - 40)
                    end = min(len(content), match.end() + 40)
                    snippet = content[start:end].replace('\n', ' ')
                    print(f"  Snippet: ...{snippet}...")
                if len(matches) > 5:
                    print(f"  ... and {len(matches) - 5} more matches.")
                print("-" * 50)
