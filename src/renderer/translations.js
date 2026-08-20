const TRANSLATIONS = {
  pt: {
    app_title: "Biblioteca de Epubs",
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
    unit_years: "anos"
  },
  en: {
    app_title: "EPUB Library",
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
    unit_years: "years"
  }
};

let currentLocale = 'pt';

function setLocale(locale) {
  if (TRANSLATIONS[locale]) {
    currentLocale = locale;
  }
}

function getLocale() {
  return currentLocale;
}

function t(key, params = {}) {
  let str = TRANSLATIONS[currentLocale][key] || TRANSLATIONS.pt[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

window.i18n = { setLocale, getLocale, t };
