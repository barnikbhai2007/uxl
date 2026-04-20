import re

def count_tags(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    opens = re.findall(r'<div(?![a-zA-Z])', content)
    closes = re.findall(r'</div>', content)
    
    m_opens = re.findall(r'<motion\.div(?![a-zA-Z])', content)
    m_closes = re.findall(r'</motion\.div>', content)
    
    print(f"div opens: {len(opens)}")
    print(f"div closes: {len(closes)}")
    print(f"motion.div opens: {len(m_opens)}")
    print(f"motion.div closes: {len(m_closes)}")
    
    # Simple stack trace
    stack = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # This is very crude but might find the first unbalanced line
        for match in re.finditer(r'<(div|motion\.div)|</(div|motion\.div)>', line):
            tag = match.group(0)
            if tag.startswith('</'):
                if not stack:
                    print(f"Excess closing tag {tag} at line {i+1}")
                else:
                    stack.pop()
            else:
                if not tag.endswith('/>'):
                    stack.append((tag, i+1))
    
    if stack:
        print(f"Unclosed tags at end: {len(stack)}")
        for tag, line in stack[-5:]:
            print(f"  {tag} opened at line {line}")

count_tags('src/App.tsx')
