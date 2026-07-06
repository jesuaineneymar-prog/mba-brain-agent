#!/bin/bash
# Build the complete page.tsx by concatenating parts
cat /home/z/my-project/scripts/page-part1.tsx > /home/z/my-project/src/app/page.tsx
cat /home/z/my-project/scripts/page-part2.tsx >> /home/z/my-project/src/app/page.tsx
cat /home/z/my-project/scripts/page-part3.tsx >> /home/z/my-project/src/app/page.tsx
echo "page.tsx assembled: $(wc -l < /home/z/my-project/src/app/page.tsx) lines"