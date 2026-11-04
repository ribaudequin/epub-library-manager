#!/usr/bin/env node
/**
 * i18n validation script — checks key parity, missing translations, placeholder syntax.
 * Run with: npm run i18n:validate
 */

const fs = require('fs');
const path = require('path');

const TRANSLATIONS_PATH = path.join(__dirname, '../src/renderer/translations.js');

function extractTranslations() {
  const content = fs.readFileSync(TRANSLATIONS_PATH, 'utf-8');

  // Extract the TRANSLATIONS object using regex (simple approach for our structured file)
  const match = content.match(/const TRANSLATIONS = (\{[\s\S]*?\});\s*let currentLocale/);
  if (!match) {
    throw new Error('Could not extract TRANSLATIONS object from translations.js');
  }

  // Use Function constructor to safely evaluate the object (no external deps)
  const translations = new Function('return ' + match[1])();
  return translations;
}

function validate() {
  const content = fs.readFileSync(TRANSLATIONS_PATH, 'utf-8');
  const translations = extractTranslations(content);
  const locales = Object.keys(translations);

  console.log('🔍 i18n Validation Report');
  console.log('==========================\n');
  console.log(`Locales found: ${locales.join(', ')}\n`);

  // Collect all keys across all locales
  const allKeys = new Set();
  for (const locale of locales) {
    for (const key of Object.keys(translations[locale])) {
      allKeys.add(key);
    }
  }

  const sortedKeys = Array.from(allKeys).sort();
  console.log(`Total unique keys: ${sortedKeys.length}\n`);

  // 1. Key parity check
  console.log('📋 1. KEY PARITY CHECK');
  console.log('----------------------');
  let parityIssues = 0;
  for (const locale of locales) {
    const localeKeys = Object.keys(translations[locale]);
    const missing = sortedKeys.filter(k => !localeKeys.includes(k));
    const extra = localeKeys.filter(k => !sortedKeys.includes(k)); // shouldn't happen
    if (missing.length > 0) {
      console.log(`  ❌ ${locale}: MISSING ${missing.length} key(s): ${missing.join(', ')}`);
      parityIssues++;
    } else {
      console.log(`  ✅ ${locale}: Complete (${localeKeys.length} keys)`);
    }
  }
  if (parityIssues === 0) {
    console.log('  ✅ All locales have identical key sets\n');
  } else {
    console.log(`  ⚠️  ${parityIssues} locale(s) have parity issues\n`);
  }

  // 2. Placeholder syntax validation
  console.log('🔧 2. PLACEHOLDER SYNTAX CHECK');
  console.log('-------------------------------');
  const placeholderRegex = /\{(\w+)\}/g;
  let placeholderIssues = 0;
  for (const locale of locales) {
    for (const [key, value] of Object.entries(translations[locale])) {
      if (typeof value === 'string') {
        const matches = value.match(placeholderRegex);
        if (matches) {
          for (const match of matches) {
            const placeholder = match.slice(1, -1);
            // Check for common issues: empty, numbers only, special chars
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(placeholder)) {
              console.log(`  ⚠️  ${locale}.${key}: Suspicious placeholder "${match}"`);
              placeholderIssues++;
            }
          }
        }
      }
    }
  }
  if (placeholderIssues === 0) {
    console.log('  ✅ All placeholders follow valid naming convention\n');
  } else {
    console.log(`  ⚠️  ${placeholderIssues} placeholder issue(s) found\n`);
  }

  // 3. Empty/missing values check
  console.log('📝 3. EMPTY VALUE CHECK');
  console.log('------------------------');
  let emptyIssues = 0;
  for (const locale of locales) {
    for (const [key, value] of Object.entries(translations[locale])) {
      if (typeof value === 'string' && value.trim() === '') {
        console.log(`  ⚠️  ${locale}.${key}: Empty string`);
        emptyIssues++;
      }
    }
  }
  if (emptyIssues === 0) {
    console.log('  ✅ No empty translation values\n');
  } else {
    console.log(`  ⚠️  ${emptyIssues} empty value(s) found\n`);
  }

  // 4. Machine-translated detection (heuristic)
  console.log('🤖 4. MACHINE-TRANSLATED HEURISTIC');
  console.log('-----------------------------------');
  // Known brand/technical terms that are legitimately identical
  const knownIdentical = new Set([
    'app_title', 'about_title', 'about_credits_title', 'about_developed_by',
    'about_footer', 'about_github_link', 'about_kofi', 'about_patreon',
    'about_support_kofi', 'crypto_support_title', 'about_crypto_title',
    'about_crypto_note', 'about_etherscan_link', 'about_solscan_link',
    'btn_copy', 'detail_count', 'series_volume_count', 'series_read_count',
    'detail_read_count', 'stats_total_volumes', 'serie_ongoing', 'serie_hiatus',
    'state_hiatus', 'chart_activity_title', 'chart_largest_title', 'chart_state_title'
  ]);

  let mtSuspects = 0;
  if (translations.pt && translations.en) {
    for (const key of sortedKeys) {
      const ptVal = translations.pt[key];
      const enVal = translations.en[key];
      if (ptVal && enVal && ptVal === enVal && typeof ptVal === 'string') {
        // Check if it's a technical string that might legitimately be the same
        const technical = /^(ETH|SOL|URL|API|HTML|CSS|JS|JSON|IP|TCP|UDP|HTTP|HTTPS|EPUB|ISBN|DOI|ORCID|PMID|ARXIV|SSRN|ISBN|ISSN|DOI)$/i.test(ptVal) ||
                          /^[0-9a-fA-Fx]{10,}$/.test(ptVal) || // hex addresses
                          /^https?:\/\//.test(ptVal) || // URLs
                          knownIdentical.has(key);
        if (!technical) {
          console.log(`  ⚠️  ${key}: Identical pt/en value "${ptVal}" — possible missing translation`);
          mtSuspects++;
        }
      }
    }
  }
  if (mtSuspects === 0) {
    console.log('  ✅ No obvious machine-translation suspects\n');
  } else {
    console.log(`  ⚠️  ${mtSuspects} suspect(s) — review recommended\n`);
  }

  // 5. SUPPORTED_LOCALES registry check
  console.log('🗂️  5. SUPPORTED_LOCALES REGISTRY CHECK');
  console.log('----------------------------------------');
  const registryMatch = content.match(/const SUPPORTED_LOCALES = (\{[\s\S]*?\});\s*function resolveLocale/);
  if (registryMatch) {
    const registry = new Function('return ' + registryMatch[1])();
    const registryLocales = Object.keys(registry);
    const missingInRegistry = locales.filter(l => !registryLocales.includes(l));
    const extraInRegistry = registryLocales.filter(l => !locales.includes(l) && l !== 'ja'); // ja is commented

    if (missingInRegistry.length === 0 && extraInRegistry.length === 0) {
      console.log('  ✅ Registry matches translation locales\n');
    } else {
      if (missingInRegistry.length > 0) {
        console.log(`  ❌ Missing in registry: ${missingInRegistry.join(', ')}`);
      }
      if (extraInRegistry.length > 0) {
        console.log(`  ⚠️  Extra in registry (no translations): ${extraInRegistry.join(', ')}`);
      }
    }
  } else {
    console.log('  ❌ Could not extract SUPPORTED_LOCALES registry\n');
  }

  // Summary
  console.log('📊 SUMMARY');
  console.log('==========');
  const totalIssues = parityIssues + placeholderIssues + emptyIssues + mtSuspects;
  if (totalIssues === 0) {
    console.log('✅ All checks passed!');
    process.exit(0);
  } else {
    console.log(`⚠️  ${totalIssues} issue(s) found — review recommended`);
    process.exit(1);
  }
}

function extractTranslations(content) {
  // Extract the TRANSLATIONS object using regex
  const match = content.match(/const TRANSLATIONS = (\{[\s\S]*?\});\s*let currentLocale/);
  if (!match) {
    throw new Error('Could not extract TRANSLATIONS object from translations.js');
  }

  // Use Function constructor to safely evaluate the object
  const translations = new Function('return ' + match[1])();
  return translations;
}

validate();