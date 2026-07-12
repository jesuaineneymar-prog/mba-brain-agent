from fpdf import FPDF
import os

class CodePDF(FPDF):
    def header(self):
        self.set_font("DejaVu Sans Mono", "B", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, "MBA Brain Agent - Codigo Fonte", align="C", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu Sans Mono", "", 7)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Página {self.page_no()}/{{nb}}", align="C")

    def add_code_file(self, filepath, title):
        self.add_page()
        self.set_font("DejaVu Sans Mono", "B", 11)
        self.set_text_color(20, 20, 20)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_font("DejaVu Sans Mono", "", 7)
        self.set_text_color(80, 80, 80)
        self.cell(0, 5, filepath, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()

        self.set_font("DejaVu Sans Mono", "", 6.5)
        self.set_text_color(30, 30, 30)

        for i, line in enumerate(lines, 1):
            # Truncate very long lines
            display = line.rstrip("\n\r")
            if len(display) > 120:
                display = display[:117] + "..."

            # Line number
            self.set_text_color(140, 140, 140)
            num_str = f"{i:>4}  "
            self.cell(12, 3.2, num_str)

            # Code
            self.set_text_color(30, 30, 30)
            self.cell(0, 3.2, display, new_x="LMARGIN", new_y="NEXT")

            # Page break check
            if self.get_y() > 272:
                self.add_page()

pdf = CodePDF()
pdf.alias_nb_pages()

# Register monospace font
pdf.add_font("DejaVu Sans Mono", "", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", uni=True)
pdf.add_font("DejaVu Sans Mono", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", uni=True)

base = "/home/z/my-project"

files = [
    ("src/middleware.ts", "middleware.ts"),
    ("src/app/api/send-message/route.ts", "api/send-message/route.ts"),
    ("src/app/api/inbox/route.ts", "api/inbox/route.ts"),
    ("src/app/api/scrape/route.ts", "api/scrape/route.ts"),
    ("src/lib/social-scrapers.ts", "lib/social-scrapers.ts"),
    ("src/app/setup-cookies/page.tsx", "setup-cookies/page.tsx"),
    ("src/app/api/cookies/route.ts", "api/cookies/route.ts"),
]

for filepath, title in files:
    full = os.path.join(base, filepath)
    if os.path.exists(full):
        pdf.add_code_file(full, title)
    else:
        print(f"AVISO: {full} nao encontrado")

out = "/home/z/my-project/download/mba-codigo.pdf"
pdf.output(out)
print(f"PDF gerado: {out}")
print(f"Tamanho: {os.path.getsize(out) / 1024:.0f} KB")
print(f"Páginas: {pdf.page_no()}")