"""
Builds sample lab reports for testing the report → challenges flow (run: python make_reports.py).
Each is an HTML page printed to PDF (and a PNG for the photo path) with headless Chrome.
The lab and patient are made up, and every page says "Sample report for app testing".
"""
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

LAB = {
    "name": "Greenfield Diagnostics",
    "line": "NABL-style sample lab · Sector 21, Pune · Sample report for app testing",
}

# (file, patient, age/sex, sections: [(panel, [(test, value, unit, range, flag)])], doctor note)
REPORTS = [
    (
        "report-1-vitamins-low",
        "Rahul Mehra",
        "32 Y / Male",
        [
            ("Vitamins", [
                ("25-OH Vitamin D (Total)", "14.2", "ng/mL", "30 - 100", "LOW"),
                ("Vitamin B12", "168", "pg/mL", "211 - 911", "LOW"),
                ("Folic Acid", "7.9", "ng/mL", "3.1 - 20.5", ""),
            ]),
            ("Complete Blood Count", [
                ("Haemoglobin", "13.6", "g/dL", "13.0 - 17.0", ""),
                ("Total WBC Count", "6,800", "/cumm", "4,000 - 10,000", ""),
                ("Platelet Count", "2.4", "lakh/cumm", "1.5 - 4.1", ""),
                ("MCV", "96", "fL", "83 - 101", ""),
            ]),
            ("Thyroid Profile", [
                ("TSH", "2.1", "µIU/mL", "0.27 - 4.2", ""),
            ]),
        ],
        "Vitamin D deficiency and low B12. Correlate clinically. Patient reports tiredness through the day.",
    ),
    (
        "report-2-sugar-cholesterol-high",
        "Anita Sharma",
        "45 Y / Female",
        [
            ("Diabetes Screen", [
                ("HbA1c", "6.1", "%", "< 5.7", "HIGH"),
                ("Fasting Blood Sugar", "112", "mg/dL", "70 - 99", "HIGH"),
                ("Estimated Average Glucose", "128", "mg/dL", "-", ""),
            ]),
            ("Lipid Profile", [
                ("Total Cholesterol", "228", "mg/dL", "< 200", "HIGH"),
                ("Triglycerides", "196", "mg/dL", "< 150", "HIGH"),
                ("HDL Cholesterol", "38", "mg/dL", "> 50", "LOW"),
                ("LDL Cholesterol (calc.)", "151", "mg/dL", "< 100", "HIGH"),
                ("VLDL", "39", "mg/dL", "< 30", "HIGH"),
            ]),
            ("Liver Function", [
                ("SGPT (ALT)", "34", "U/L", "< 35", ""),
            ]),
        ],
        "Prediabetic range HbA1c with raised LDL and triglycerides. Lifestyle changes advised; review in 3 months.",
    ),
    (
        "report-3-iron-low",
        "Priya Nair",
        "27 Y / Female",
        [
            ("Complete Blood Count", [
                ("Haemoglobin", "10.4", "g/dL", "12.0 - 15.0", "LOW"),
                ("RBC Count", "4.1", "mill/cumm", "3.8 - 4.8", ""),
                ("MCV", "74", "fL", "83 - 101", "LOW"),
                ("MCH", "24.1", "pg", "27 - 32", "LOW"),
                ("RDW-CV", "16.8", "%", "11.6 - 14.0", "HIGH"),
            ]),
            ("Iron Studies", [
                ("Serum Iron", "42", "µg/dL", "50 - 170", "LOW"),
                ("Serum Ferritin", "8.5", "ng/mL", "13 - 150", "LOW"),
                ("TIBC", "432", "µg/dL", "250 - 450", ""),
                ("Transferrin Saturation", "9.7", "%", "20 - 50", "LOW"),
            ]),
            ("Thyroid Profile", [
                ("TSH", "3.4", "µIU/mL", "0.27 - 4.2", ""),
            ]),
        ],
        "Picture suggestive of iron deficiency. Complains of breathlessness on climbing stairs and low energy.",
    ),
]


def html(file, patient, agesex, sections, note):
    rows = ""
    for panel, tests in sections:
        rows += f'<tr class="panel"><td colspan="4">{panel}</td></tr>'
        for test, value, unit, rng, flag in tests:
            cls = "flag" if flag else ""
            mark = f' <span class="tag">{flag}</span>' if flag else ""
            rows += (
                f'<tr><td>{test}</td><td class="v {cls}">{value}{mark}</td>'
                f"<td>{unit}</td><td>{rng}</td></tr>"
            )
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 16mm 14mm; }}
  body {{ font-family: Arial, Helvetica, sans-serif; color: #1c2321; font-size: 12px; }}
  .head {{ display: flex; justify-content: space-between; align-items: flex-end;
          border-bottom: 3px solid #1f6f9c; padding-bottom: 8px; }}
  .lab {{ font-size: 22px; font-weight: 700; color: #1f6f9c; }}
  .sub {{ color: #555; font-size: 11px; margin-top: 2px; }}
  .stamp {{ border: 1.5px solid #b42318; color: #b42318; padding: 4px 8px; font-size: 10px;
           font-weight: 700; letter-spacing: .5px; }}
  .pt {{ display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 14px 0;
        padding: 10px; background: #f3f6f8; }}
  .pt b {{ display: inline-block; width: 110px; color: #444; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; background: #1f6f9c; color: #fff; padding: 6px 8px; font-size: 11px; }}
  td {{ padding: 6px 8px; border-bottom: 1px solid #e3e3e3; }}
  tr.panel td {{ font-weight: 700; background: #eaf2f7; color: #1f6f9c; }}
  .v {{ font-weight: 700; }}
  .flag {{ color: #b42318; }}
  .tag {{ font-size: 9px; border: 1px solid #b42318; padding: 1px 4px; margin-left: 6px; }}
  .note {{ margin-top: 16px; padding: 10px; border-left: 3px solid #1f6f9c; background: #f7f9fb; }}
  .foot {{ margin-top: 28px; display: flex; justify-content: space-between; color: #555;
          font-size: 10px; border-top: 1px solid #ccc; padding-top: 8px; }}
</style></head><body>
<div class="head">
  <div><div class="lab">{LAB['name']}</div><div class="sub">{LAB['line']}</div></div>
  <div class="stamp">SAMPLE · NOT A REAL REPORT</div>
</div>
<div class="pt">
  <div><b>Patient</b> {patient}</div><div><b>Age / Sex</b> {agesex}</div>
  <div><b>Sample ID</b> GF-{abs(hash(file)) % 900000 + 100000}</div><div><b>Collected</b> 12 Nov 2026, 08:10</div>
  <div><b>Referred by</b> Self</div><div><b>Reported</b> 12 Nov 2026, 18:45</div>
</div>
<table><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference range</th></tr>{rows}</table>
<div class="note"><b>Remarks:</b> {note}</div>
<div class="foot"><span>Sample report generated for testing the Nourish AI app. Not for medical use.</span><span>Page 1 of 1</span></div>
</body></html>"""


for file, patient, agesex, sections, note in REPORTS:
    page = os.path.join(HERE, f"{file}.html")
    with open(page, "w", encoding="utf-8") as f:
        f.write(html(file, patient, agesex, sections, note))
    url = "file:///" + page.replace("\\", "/")
    pdf = os.path.join(HERE, f"{file}.pdf")
    png = os.path.join(HERE, f"{file}.png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf}", url], check=True, capture_output=True, timeout=60)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--window-size=900,1150", f"--screenshot={png}", url],
                   check=True, capture_output=True, timeout=60)
    os.remove(page)
    print(file, os.path.getsize(pdf), os.path.getsize(png))
