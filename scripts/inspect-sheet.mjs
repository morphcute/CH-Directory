const SHEET_ID = "1HUANmtnLjlGiNjyiYs4Dgp5rmm_71oH2qFuXMeZXkZw";

async function main() {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
  console.log("Fetching:", gvizUrl);
  const res = await fetch(gvizUrl);
  const text = await res.text();
  console.log("Response text length:", text.length);
  
  const jsonStr = text.replace(/^[/*\w\s.]*\(/, "").replace(/\);?\s*$/, "");
  const data = JSON.parse(jsonStr);
  const rows = data.table?.rows || [];
  const cols = data.table?.cols || [];
  console.log("Cols:", cols.map((c, i) => `${i}: ${c?.label || c?.id}`));
  console.log("Total rows:", rows.length);

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i]?.c?.map(cell => cell?.f || cell?.v || "") || [];
    console.log(`Row ${i}:`, JSON.stringify(r));
  }

  // Look for Yuki
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]?.c?.map(cell => cell?.f || cell?.v || "") || [];
    const str = r.join(" ").toLowerCase();
    if (str.includes("yuki")) {
      console.log(`FOUND YUKI at row ${i}:`, JSON.stringify(r));
    }
  }
}

main().catch(console.error);
