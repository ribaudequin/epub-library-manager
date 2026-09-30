# EPUB Shelf — Documentation

A cross-platform desktop application for managing your EPUB library, organized by series. Automatically extracts metadata and cover art from EPUBs, tracks reading progress, and provides intelligent search and sorting.

## Windows Code Signing Note

Windows builds are currently **unsigned**. This results in:
- Higher SmartScreen warnings on first launch (Windows may show "Unknown publisher")
- The installer and portable executables have elevated antivirus false-positive rates

**Justification:** Code signing certificates (≥$200/year) are not economically viable for this open-source project. Users can safely bypass warnings via **"More info" → "Run anyway"**.

## Repository

[https://github.com/ribaudequin/epub-library-manager](https://github.com/ribaudequin/epub-library-manager)

## Credits

- **Author:** Marcelo Salvador [@ribaudequin](https://github.com/ribaudequin)
- Cover extraction uses `@xmldom/xmldom` and `adm-zip`

## Support

If you find this project useful, consider supporting its development:

- **Ko-fi:** [https://ko-fi.com/A0383T5](https://ko-fi.com/A0383T5)
- **ETH (any EVM chain):** `0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4`
- **SOL:** `Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf`
