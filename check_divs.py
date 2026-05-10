from html.parser import HTMLParser

class DivCounter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.div_depth = 0
        self.log = []

    def handle_starttag(self, tag, attrs):
        if tag == 'div':
            self.div_depth += 1
            for attr in attrs:
                if attr[0] == 'id' and attr[1] == 'app-container':
                    self.log.append(f'app-container starts at depth {self.div_depth}')
                if attr[0] == 'id' and attr[1] == 'screen-student-home':
                    self.log.append(f'screen-student-home starts at depth {self.div_depth}')

    def handle_endtag(self, tag):
        if tag == 'div':
            self.div_depth -= 1
            if self.div_depth == 1:
                self.log.append(f'Depth reached 1')

parser = DivCounter()
with open('index_api.html', 'r', encoding='utf-8') as f:
    parser.feed(f.read())

for line in parser.log:
    print(line)
print(f'Final depth: {parser.div_depth}')
