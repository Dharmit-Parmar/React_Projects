import sys
import logging
from pdf2docx import Converter

# Suppress debug logs from pdf2docx
logging.getLogger('pdf2docx').setLevel(logging.ERROR)

def main():
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_docx.py <input.pdf> <output.docx>")
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_docx = sys.argv[2]

    try:
        cv = Converter(input_pdf)
        cv.convert(output_docx, start=0, end=None)
        cv.close()
        print(f"Success: {output_docx}")
    except Exception as e:
        print(f"Error during conversion: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
