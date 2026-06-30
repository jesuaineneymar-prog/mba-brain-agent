import re
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.texts = []
        self.skip = False
        self.skip_tags = {'script', 'style', 'noscript'}

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.skip = True

    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.skip = False

    def handle_data(self, data):
        if not self.skip:
            text = data.strip()
            if text:
                self.texts.append(text)

with open("/home/z/my-project/upload/Claude (1)", "r", encoding="utf-8") as f:
    content = f.read()

# Extract the HTML part between the boundaries
match = re.search(r'<!DOCTYPE html>(.*)', content, re.DOTALL)
if match:
    html = match.group(1)
    end = html.rfind('</html>')
    if end != -1:
        html = html[:end + 7]

    extractor = TextExtractor()
    extractor.feed(html)

    # Filter out very short lines and common UI elements
    skip_words = ['claude', 'anthropic', 'copy', 'share', 'read aloud', 'thumbs up', 'thumbs down', 'restart', 'new chat', 'download', 'privacy', 'terms', 'accept']
    meaningful = []
    for t in extractor.texts:
        t_lower = t.lower()
        if len(t) > 20 and not any(w in t_lower for w in skip_words):
            meaningful.append(t)
        elif len(t) > 50:
            meaningful.append(t)

    for line in meaningful:
        print(line)
        print("---")
else:
    print("No HTML content found")