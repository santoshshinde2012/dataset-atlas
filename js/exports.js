/** Reproducible metadata inventories and checked-resource download recipes. */
import { iso3For } from './identifiers.js';
import { parseQuery } from './search.js';
import { primaryResource } from './resource.js';

export function csvText(columns, rows, { spreadsheetSafe = false } = {}) {
  const cell = (value) => {
    let text = String(value ?? '');
    if (spreadsheetSafe && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function inventory(list, requirements = {}, selections = {}) {
  const parsed = parseQuery(requirements.search);
  const scoped = { country: requirements.country || requirements.focusCountry || parsed.country || '', startYear: requirements.startYear || parsed.startYear, endYear: requirements.endYear || parsed.endYear, level: requirements.level || '', variables: requirements.variables || [] };
  scoped.countryIso3 = iso3For(scoped.country);
  const selected = (d) => (d.resources || []).find((r) => r.url === selections[d.id])
    || ((scoped.country || scoped.startYear) ? (d.resources || []).find((r) => r.kind === 'api' && new URL(r.url).hostname === 'api.worldbank.org') : null) || primaryResource(d);
  return { version: 1, exportedAt: new Date().toISOString(), requirements: scoped, datasets: list.map((d) => ({
    id: d.id, title: d.title, source: d.source, landingPage: d.landingPage || d.url,
    license: d.license, licenseUrl: d.licenseUrl || null, lastSuccessfulLinkCheck: d.verified || null,
    coverageStart: d.coverageStart, coverageEnd: d.coverageEnd, publicationYear: d.publicationYear || null,
    resources: d.resources || [], selectedResource: selected(d),
  })) };
}
export function inventoryCsv(list, requirements = {}, selections = {}) {
  const data = inventory(list, requirements, selections);
  const columns = ['id', 'title', 'source', 'landingPage', 'resourceUrl', 'resourceKind', 'format', 'license', 'licenseUrl', 'coverageStart', 'coverageEnd', 'publicationYear', 'lastSuccessfulLinkCheck'];
  return csvText(columns, data.datasets.map((d) => [d.id, d.title, d.source, d.landingPage, d.selectedResource?.url, d.selectedResource?.kind,
    d.selectedResource?.format, d.license, d.licenseUrl, d.coverageStart, d.coverageEnd, d.publicationYear, d.lastSuccessfulLinkCheck]), { spreadsheetSafe: true });
}

export function pythonRecipe(list, requirements = {}, selections = {}) {
  const data = inventory(list, requirements, selections);
  return `#!/usr/bin/env python3
"""Dataset Atlas resource recipe. Run with Python 3; uses only the standard library.
Files go in ./atlas-data. Source pages and unsupported APIs are skipped.
Country/date scoping applies to World Bank APIs and recognized OWID CSVs.
Other files retain provider scope.
Confirm licenses at source before use. No source content is executed.
"""
import csv, hashlib, io, json, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
CONFIG = json.loads(${JSON.stringify(JSON.stringify(data))})
OUT = Path("atlas-data")
OUT.mkdir(exist_ok=True)
LIMIT = 100 * 1024 * 1024

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "DatasetAtlas/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        if "text/html" in res.headers.get("Content-Type", "").lower():
            raise ValueError("Provider returned HTML instead of data")
        raw = res.read(LIMIT + 1)
        if len(raw) > LIMIT:
            raise ValueError("Resource exceeds 100 MB limit; download from provider")
        return raw

for d in CONFIG["datasets"]:
    r = d.get("selectedResource")
    if not r:
        print("SKIP source page:", d["title"], d["landingPage"])
        continue
    try:
        url = r["url"]
        u = urllib.parse.urlsplit(url)
        if r["kind"] == "api" and u.hostname == "api.worldbank.org" and "/indicator/" in u.path and "/country/" in u.path:
            country = CONFIG["requirements"].get("country") or "all"
            indicator = u.path.split("/indicator/", 1)[1].strip("/")
            query = {"format": "json", "per_page": "1000"}
            start = CONFIG["requirements"].get("startYear")
            end = CONFIG["requirements"].get("endYear")
            if start and end:
                query["date"] = f"{start}:{end}"
            elif start or end:
                raise ValueError("Choose both years to scope a World Bank extract")
            existing = urllib.parse.parse_qs(u.query)
            if "source" in existing:
                query["source"] = existing["source"][0]
            endpoint = f"https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"
            rows, page, pages = [], 1, 1
            while page <= pages:
                query["page"] = str(page)
                payload = json.loads(get(endpoint + "?" + urllib.parse.urlencode(query)))
                if not isinstance(payload, list) or len(payload) != 2 or not isinstance(payload[0], dict):
                    raise ValueError("Unexpected World Bank API response")
                pages = int(payload[0].get("pages", 1))
                if pages > 100:
                    raise ValueError("More than 100 pages; narrow country/date requirements")
                rows.extend(payload[1] or [])
                page += 1
            buf = io.StringIO(newline="")
            writer = csv.writer(buf)
            writer.writerow(["iso3", "country", "year", "value", "indicator", "unit"])
            for row in rows:
                writer.writerow([row.get("countryiso3code"), row.get("country", {}).get("value"), row.get("date"), row.get("value"), indicator, row.get("unit")])
            raw, suffix = buf.getvalue().encode(), ".csv"
        elif r["kind"] == "download":
            raw = get(url)
            d["sourceDownload"] = {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)}
            is_owid = (u.hostname in ["ourworldindata.org", "catalog.ourworldindata.org"] or (u.hostname == "raw.githubusercontent.com" and u.path.startswith("/owid/"))) and u.path.endswith(".csv")
            scope = CONFIG["requirements"]
            if is_owid and (scope.get("country") or scope.get("startYear") or scope.get("endYear")):
                reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
                names = reader.fieldnames or []
                iso_field = next((k for k in ["iso_code", "Code", "ISO3"] if k in names), None)
                year_field = next((k for k in ["year", "Year"] if k in names), None)
                if not iso_field or not year_field:
                    raise ValueError("OWID CSV lacks recognized ISO/year columns; inspect source schema")
                if scope.get("country") and not scope.get("countryIso3"):
                    raise ValueError("Country has no known ISO-3 mapping")
                buf = io.StringIO(newline="")
                writer = csv.DictWriter(buf, fieldnames=names)
                writer.writeheader()
                kept = 0
                for row in reader:
                    code = row[iso_field]
                    if len(code) != 3 or code in ["WLD", "EUU"] or code.startswith("OWID_"):
                        continue
                    if scope.get("countryIso3") and code != scope["countryIso3"]:
                        continue
                    year = int(row[year_field])
                    if scope.get("startYear") and year < scope["startYear"]:
                        continue
                    if scope.get("endYear") and year > scope["endYear"]:
                        continue
                    writer.writerow(row)
                    kept += 1
                raw = buf.getvalue().encode()
                d["extractRows"] = kept
            if is_owid and u.hostname == "ourworldindata.org" and u.path.startswith("/grapher/"):
                try:
                    d["providerMetadata"] = json.loads(get(urllib.parse.urlunsplit((u.scheme, u.netloc, u.path[:-4] + ".metadata.json", "", ""))))
                except Exception as metadata_error:
                    d["metadataError"] = str(metadata_error)
            suffix = ".zip" if "downloadformat=csv" in url else Path(u.path).suffix
            if suffix.lower() not in [".csv", ".tsv", ".json", ".zip", ".xlsx", ".parquet", ".geojson"]:
                suffix = ".data"
        else:
            print("SKIP unsupported API:", d["title"], url)
            continue
        target = OUT / (d["id"] + suffix)
        target.write_bytes(raw)
        d["download"] = {"file": str(target), "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "downloadedAt": datetime.now(timezone.utc).isoformat()}
        print("SAVED", target)
    except Exception as exc:
        d["downloadError"] = str(exc)
        print("FAILED", d["title"], exc)
(OUT / "provenance.json").write_text(json.dumps(CONFIG, indent=2) + "\\n")
`;
}
