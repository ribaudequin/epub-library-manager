// Locale registry — single source of truth for supported locales and metadata.
// Adding a new locale: add entry here, add translation object below, no other code changes.
const SUPPORTED_LOCALES = {
  pt: { name: 'Portuguese', fallback: ['en'], dateTag: 'pt-PT' },
  en: { name: 'English', fallback: ['pt'], dateTag: 'en-GB' },
  // ja: { name: 'Japanese', fallback: ['en'], dateTag: 'ja-JP' }, // Phase 5
};

function resolveLocale(requested) {
  if (SUPPORTED_LOCALES[requested]) return requested;
  const chain = SUPPORTED_LOCALES[requested]?.fallback || [];
  for (const fb of chain) {
    if (SUPPORTED_LOCALES[fb]) return fb;
  }
  return 'pt'; // ultimate default
}

const TRANSLATIONS = {
  pt: {
    app_title: "EPUBShelf",
    search_placeholder: "Ctrl+K  Pesquisar…",
    sort_name_asc: "Nome A–Z",
    sort_name_desc: "Nome Z–A",
    sort_progress: "Progresso %",
    sort_mtime: "Atualização",
    btn_select_folder: "Seleccionar pasta",
    btn_refresh: "Actualizar biblioteca",
    btn_back: "← Voltar às séries",
    btn_toggle_all_read: "Marcar tudo como lido",
    btn_toggle_all_unread: "Marcar tudo como não lido",
    detail_count: "{count} volume(s)",
    detail_read_count: "{count} lido(s)",
    detail_progress_label: "{pct}% concluído",
    series_volume_count: "{count} volume(s)",
    series_read_count: "{count} lido(s)",
    search_info: "{filtered} de {total} séries",
    loading_scan: "A digitalizar biblioteca…",
    loading_progress: "A digitalizar… {pct}% ({done}/{total})",
    cache_status_cached: "{count} séries em cache",
    cache_status_scanned: "Digitalizado",
    empty_state_title: "Nenhuma biblioteca selecionada.",
    empty_state_desc: "Clique em «Seleccionar pasta» para escolher a pasta raiz que contém as séries.",
    empty_state_no_epubs: "A pasta seleccionada não contém séries com ficheiros .epub.",
    serie_state_ongoing: "Em andamento — nova atualização esperada",
    serie_state_completed: "Completa — todos os volumes lançados",
    serie_state_cancelled: "Cancelada — produção interrompida",
    serie_state_hiatus: "Hiatus — pausa indefinida",
    search_label: "Pesquisar séries",
    search_aria: "Pesquisar (Ctrl+K)",
    search_clear_aria: "Limpar pesquisa",
    sort_label: "Ordenar por",
    status_lido: "Lido",
    status_nao_lido: "Não Lido",
    status_pendente: "Pendente",
    serie_ongoing: "Ongoing",
    serie_completed: "Acabada",
    serie_cancelled: "Cancelada",
    serie_hiatus: "Hiatus",
    date_today: "hoje",
    date_ago: "há {count} {unit}",
    unit_day: "dia",
    unit_days: "dias",
    unit_week: "semana",
    unit_weeks: "semanas",
    unit_month: "mês",
    unit_months: "meses",
    unit_year: "ano",
    unit_years: "anos",
    btn_favorite: "Favorito",
    btn_unfavorite: "Remover favorito",
    filter_favorites: "Favoritos",
    theme_toggle_light: 'Mudar para tema claro',
    theme_toggle_dark: 'Mudar para tema escuro',
    stats_title: 'Estatísticas',
    stats_total_series: 'Séries',
    stats_total_volumes: 'Volumes',
    stats_completed_readings: 'Lidos',
    stats_overall_progress: 'Progresso',
    chart_state_title: 'Séries por Estado',
    chart_largest_title: 'Maiores Séries',
    chart_activity_title: 'Atividade (últimos 30 dias)',
    state_ongoing: 'Em andamento',
    state_completed: 'Completa',
    state_cancelled: 'Cancelada',
    state_hiatus: 'Hiatus',
    about_title: 'About / Sobre',
    about_desc: 'Gestor de biblioteca EPUB organizado por séries.',
    about_credits_title: 'Credits',
    about_developed_by: 'Developed by',
    about_support_kofi: 'Support on Ko-fi',
    about_github_link: 'GitHub',
    about_footer: 'Made with ❤️ for ebook readers',
    crypto_support_title: 'Crypto Support',
    crypto_eth: 'ETH',
    crypto_sol: 'SOL',
    // Phase 3: hardcoded strings moved from main.js/renderer.js/index.html
    dialog_select_library_title: 'Selecionar pasta raiz da biblioteca',
    excerpt_loading: 'A extrair…',
    excerpt_volume_01: 'Excerto do volume 01',
    btn_favorite_star: '★ Favorito',
    btn_unfavorite_star: '★ Remover',
    btn_stats_aria: 'Estatísticas',
    btn_stats_title: 'Estatísticas',
    btn_about_aria: 'Sobre',
    btn_about_title: 'Sobre',
    detail_excerpt_aria: 'Excerto do primeiro capítulo',
    stats_close_aria: 'Fechar',
    about_close_aria: 'Fechar',
    about_desc_pt: 'Organize a sua biblioteca EPUB por séries.',
    about_license_link: 'Ver licença',
    about_support_text: 'Estas ferramentas são gratuitas e de código aberto. Se alguma for útil para si, pode apoiar o trabalho.',
    about_kofi: 'Ko-fi',
    about_patreon: 'Patreon',
    about_crypto_title: 'Criptomoedas',
    about_crypto_note: 'O endereço ETH aceita qualquer cadeia compatível com EVM.',
    btn_copy: 'Copiar',
  },
  en: {
    app_title: "EPUBShelf",
    search_placeholder: "Ctrl+K  Search…",
    sort_name_asc: "Name A–Z",
    sort_name_desc: "Name Z–A",
    sort_progress: "Progress %",
    sort_mtime: "Last Updated",
    btn_select_folder: "Select folder",
    btn_refresh: "Refresh library",
    btn_back: "← Back to series",
    btn_toggle_all_read: "Mark all as read",
    btn_toggle_all_unread: "Mark all as unread",
    detail_count: "{count} volume(s)",
    detail_read_count: "{count} read",
    detail_progress_label: "{pct}% completed",
    series_volume_count: "{count} volume(s)",
    series_read_count: "{count} read",
    search_info: "{filtered} of {total} series",
    loading_scan: "Scanning library…",
    loading_progress: "Scanning… {pct}% ({done}/{total})",
    cache_status_cached: "{count} series cached",
    cache_status_scanned: "Scanned",
    empty_state_title: "No library selected.",
    empty_state_desc: "Click «Select folder» to choose the root folder containing your series.",
    empty_state_no_epubs: "The selected folder does not contain any series with .epub files.",
    serie_state_ongoing: "Ongoing — new update expected",
    serie_state_completed: "Completed — all volumes released",
    serie_state_cancelled: "Cancelled — production stopped",
    serie_state_hiatus: "Hiatus — indefinite pause",
    search_label: "Search series",
    search_aria: "Search (Ctrl+K)",
    search_clear_aria: "Clear search",
    sort_label: "Sort by",
    status_lido: "Read",
    status_nao_lido: "Unread",
    status_pendente: "Pending",
    serie_ongoing: "Ongoing",
    serie_completed: "Completed",
    serie_cancelled: "Cancelled",
    serie_hiatus: "Hiatus",
    date_today: "today",
    date_ago: "{count} {unit} ago",
    unit_day: "day",
    unit_days: "days",
    unit_week: "week",
    unit_weeks: "weeks",
    unit_month: "month",
    unit_months: "months",
    unit_year: "year",
    unit_years: "years",
    btn_favorite: "Favorite",
    btn_unfavorite: "Remove favorite",
    filter_favorites: "Favorites",
    theme_toggle_light: 'Switch to light theme',
    theme_toggle_dark: 'Switch to dark theme',
    stats_title: 'Statistics',
    stats_total_series: 'Series',
    stats_total_volumes: 'Volumes',
    stats_completed_readings: 'Read',
    stats_overall_progress: 'Progress',
    chart_state_title: 'Series by State',
    chart_largest_title: 'Largest Series',
    chart_activity_title: 'Activity (last 30 days)',
    state_ongoing: 'Ongoing',
    state_completed: 'Completed',
    state_cancelled: 'Cancelled',
    state_hiatus: 'Hiatus',
    about_title: 'About / Sobre',
    about_desc: 'EPUB library manager organized by series.',
    about_credits_title: 'Credits',
    about_developed_by: 'Developed by',
    about_support_kofi: 'Support on Ko-fi',
    about_github_link: 'GitHub',
    about_footer: 'Made with ❤️ for ebook readers',
    crypto_support_title: 'Crypto Support',
    crypto_eth: 'ETH',
    crypto_sol: 'SOL',
    // Phase 3: hardcoded strings moved from main.js/renderer.js/index.html
    dialog_select_library_title: 'Select library root folder',
    excerpt_loading: 'Extracting…',
    excerpt_volume_01: 'Volume 01 excerpt',
    btn_favorite_star: '★ Favorite',
    btn_unfavorite_star: '★ Remove',
    btn_stats_aria: 'Statistics',
    btn_stats_title: 'Statistics',
    btn_about_aria: 'About',
    btn_about_title: 'About',
    detail_excerpt_aria: 'First chapter excerpt',
    stats_close_aria: 'Close',
    about_close_aria: 'Close',
    about_desc_pt: 'EPUB library manager organized by series.',
    about_license_link: 'View license',
    about_support_text: 'These tools are free and open source. If one of them is useful to you, you can support the work.',
    about_kofi: 'Ko-fi',
    about_patreon: 'Patreon',
    about_crypto_title: 'Cryptocurrency',
    about_crypto_note: 'The ETH address accepts any EVM-compatible chain.',
    btn_copy: 'Copy',
  }
};

let currentLocale = 'pt';

function setLocale(locale) {
  const resolved = resolveLocale(locale);
  if (TRANSLATIONS[resolved]) {
    currentLocale = resolved;
  }
}

function getLocale() {
  return currentLocale;
}

function t(key, params = {}) {
  // Fallback chain: current → en → pt (English is better intermediary than Portuguese)
  let str = TRANSLATIONS[currentLocale]?.[key]
         || TRANSLATIONS.en?.[key]
         || TRANSLATIONS.pt[key]
         || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

// Expose registry and resolver for renderer/main consumers
window.i18n = { setLocale, getLocale, t, SUPPORTED_LOCALES, resolveLocale };
