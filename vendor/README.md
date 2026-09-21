# Vendored browser libraries

The static app ships these exact files so map rendering does not depend on a CDN at runtime.

| File | Version | Upstream | License |
|---|---|---|---|
| `d3.v7.min.js` | 7.9.0 | [d3/d3](https://github.com/d3/d3/tree/v7.9.0) | ISC; see `d3.LICENSE` |
| `topojson-client.min.js` | 3.1.0 | [topojson/topojson-client](https://github.com/topojson/topojson-client/tree/v3.1.0) | ISC; see `topojson-client.LICENSE` |

When updating a copy, update its version, upstream license file, and browser tests together. The deployment package includes both license notices.
