# Embedded PDF fonts

Noto Sans, Noto Sans Telugu and Noto Sans Devanagari static Regular TTFs are bundled from the official [Noto Fonts repository](https://github.com/googlefonts/noto-fonts/tree/main/hinted/ttf). The SIL Open Font License 1.1 is included as `NOTO-LICENSE.txt`. The PDF renderer embeds fonts locally; downloaded PDFs need no network or installed Indic fonts. Static fonts were chosen after inspecting variable-font exports to improve selectable text and embedded font handling.

Source files: `hinted/ttf/NotoSans/NotoSans-Regular.ttf`, `hinted/ttf/NotoSansTelugu/NotoSansTelugu-Regular.ttf`, `hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf`. Retrieved 31 October 2026. See `SHA256.json` for the exact bundled file hashes. The application does not fetch fonts at PDF-generation time. Include these assets when deploying the backend. Family-specific OFL files from the initial Google Fonts evaluation are also retained.
