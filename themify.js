// ==UserScript==
// @name         Odoo Theme Switcher (Modern UI)
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  Ajoute un sélecteur de thème + un thème moderne (boutons arrondis) sur Odoo
// @author       Alexis.Sair
// @match        *://*.odoo.com/*
// @match        *://*/web*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/lax3is/ThemiFy/refs/heads/main/themify.js
// @downloadURL  https://raw.githubusercontent.com/lax3is/ThemiFy/refs/heads/main/themify.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'odoo_theme_switcher:selected_theme';
  const STYLE_ID = 'odoo-theme-switcher-style';
  const UI_ID = 'odoo-theme-switcher-ui';
  const LOG_PREFIX = '[OTS]';

  // Gestion robuste d'injection CSS (CSP / head absent / mise à jour SPA)
  const cssInjectionState = {
    mode: /** @type {'style'|'link-data'|'link-blob'|null} */ (null),
    node: /** @type {HTMLElement|null} */ (null),
    blobUrl: /** @type {string|null} */ (null),
  };

  function log(...args) {
    try {
      // eslint-disable-next-line no-console
      console.log(LOG_PREFIX, ...args);
    } catch (_) {}
  }

  function mountNode(node) {
    const parent = document.head || document.documentElement;
    parent.appendChild(node);
  }

  function cleanupInjection() {
    try {
      if (cssInjectionState.node && cssInjectionState.node.parentNode) {
        cssInjectionState.node.parentNode.removeChild(cssInjectionState.node);
      }
    } catch (_) {}
    cssInjectionState.node = null;
    if (cssInjectionState.blobUrl) {
      try { URL.revokeObjectURL(cssInjectionState.blobUrl); } catch (_) {}
      cssInjectionState.blobUrl = null;
    }
    cssInjectionState.mode = null;
  }

  function tryInjectWithStyle(cssText) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.textContent = cssText;
    mountNode(style);

    // Tentative de détection “best effort” d'un blocage CSP.
    // Si CSP bloque, `style.sheet` est souvent null.
    let ok = true;
    try {
      ok = !!style.sheet;
    } catch (_) {
      ok = false;
    }
    return { ok, node: style };
  }

  function tryInjectWithLinkData(cssText) {
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `data:text/css;charset=utf-8,${encodeURIComponent(cssText)}`;
    mountNode(link);
    return { ok: true, node: link };
  }

  function tryInjectWithLinkBlob(cssText) {
    const blob = new Blob([cssText], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    mountNode(link);
    return { ok: true, node: link, blobUrl: url };
  }

  function setInjectedCss(cssText) {
    // Update rapide si on a déjà un <style>
    const existing = document.getElementById(STYLE_ID);
    if (existing && existing.tagName === 'STYLE') {
      existing.textContent = cssText;
      cssInjectionState.mode = 'style';
      cssInjectionState.node = existing;
      return;
    }

    cleanupInjection();

    // 1) style
    const r1 = tryInjectWithStyle(cssText);
    if (r1.ok) {
      cssInjectionState.mode = 'style';
      cssInjectionState.node = r1.node;
      return;
    }

    // 2) link data
    cleanupInjection();
    try {
      const r2 = tryInjectWithLinkData(cssText);
      cssInjectionState.mode = 'link-data';
      cssInjectionState.node = r2.node;
      return;
    } catch (_) {}

    // 3) link blob
    cleanupInjection();
    try {
      const r3 = tryInjectWithLinkBlob(cssText);
      cssInjectionState.mode = 'link-blob';
      cssInjectionState.node = r3.node;
      cssInjectionState.blobUrl = r3.blobUrl || null;
      return;
    } catch (_) {}
  }

  // “Shells” de thèmes qui couvrent vraiment le backend Odoo.
  // Les thèmes “forts” (type Rouge/Noir) réutilisent ces sélecteurs.
  const ODOO_DARK_SHELL = `
body,
.o_web_client,
.o_action_manager,
.o_action{
  background-color: var(--t-bg-1) !important;
  color: var(--t-text) !important;
}

.o_content,
.o_form_view,
.o_list_view,
.o_kanban_view{
  background-color: var(--t-bg-0) !important;
}

.o_control_panel{ background-color: var(--t-bg-1) !important; }
.o_control_panel,
.o_cp_bottom,
.o_cp_top{
  border-color: var(--t-border) !important;
  background-image:none !important;
  background-color: var(--t-bg-1) !important;
}

header.o_navbar,
.o_main_navbar{
  background-color: var(--t-bg-1) !important;
  border-color: var(--t-border) !important;
}

.o_breadcrumb,
ol.breadcrumb{ background-color: var(--t-bg-2) !important; }

.o_menu_apps,
.o_apps,
.o_main_navbar .o_menu_apps,
.o_navbar_apps_menu,
.o_menu_sections,
.o_menu_systray{
  background-color: var(--t-bg-1) !important;
  border-color: var(--t-border) !important;
  color: var(--t-text) !important;
}
.o_menu_sections .o_menu_entry,
.o_menu_sections .o_menu_entry_lvl_1,
.o_menu_sections .o_menu_entry_lvl_2,
.o_menu_sections .o_menu_entry_lvl_3,
.o_menu_sections a{ color: var(--t-text) !important; }
.o_menu_sections .o_menu_entry:hover,
.o_menu_sections a:hover{ background: color-mix(in srgb, var(--t-accent) 10%, transparent) !important; }

.o_form_statusbar{
  background: var(--t-bg-1) !important;
  border-bottom: 1px solid var(--t-border) !important;
}

.o_form_sheet_bg{ background-color: var(--t-bg-3) !important; }
.o_form_sheet_bg .o_form_sheet{ background-color: var(--t-bg-2) !important; border-color: var(--t-border) !important; }

.o_form_view .o_form_sheet,
.o_form_view .o_inner_group,
.o_form_view .o_group,
.o_form_view .o_notebook,
.o_form_view .o_chatter{
  background: var(--t-bg-2) !important;
  color: var(--t-text) !important;
}

.o_Chatter_container,
.o_mail_thread,
.o_thread_window,
.o_MessageList{ background: var(--t-bg-3) !important; }
.o_mail_thread .o_Message,
.o_attachment_box{ background: var(--t-bg-2) !important; }

.o_chatterTopbar,
[class^="o_ChatterTopbar"],
[class*=" o_ChatterTopbar"]{
  background: var(--t-bg-3) !important;
  border-color: var(--t-border) !important;
}

[class^="o_Chatter"],
[class*=" o_Chatter"],
[class^="o_mail_thread"],
[class*=" o_mail_thread"],
[class^="o_MessageList"],
[class*=" o_MessageList"],
[class^="o_ThreadView"],
[class*=" o_ThreadView"]{
  background: var(--t-bg-2) !important;
}

.o_notebook .nav-tabs,
.o_notebook_headers .nav.nav-tabs,
ul.nav.nav-tabs.flex-row.flex-nowrap{
  background: var(--t-bg-4) !important;
  border-color: var(--t-border) !important;
}
.o_notebook .nav-tabs .nav-link{ color: var(--t-text) !important; }
.o_notebook .nav-tabs .nav-link.active{
  background: var(--t-bg-2) !important;
  border-color: var(--t-border) !important;
  color: var(--t-text) !important;
}

.o_list_renderer .o_group_header,
.o_list_renderer .o_group_has_content{
  background: var(--t-bg-4) !important;
  border-bottom: 1px solid var(--t-border) !important;
}

.o_list_view table,
.o_list_view .table,
.o_list_view .o_list_table{
  background-color: var(--t-bg-2) !important;
  color: var(--t-text) !important;
}
.o_list_view thead th,
.o_list_view .o_list_table thead th{
  background: var(--t-bg-4) !important;
  color: var(--t-text) !important;
  border-color: var(--t-border) !important;
}
.o_list_view tbody tr,
.o_list_view .o_data_row{
  border-color: var(--t-border) !important;
  background-color: var(--t-bg-2) !important;
}
.o_list_view tbody tr:hover,
.o_list_view .o_data_row:hover{ background: var(--t-bg-hover) !important; }

.o_list_view .o_list_table tbody{ background-color: var(--t-bg-3) !important; }
.o_list_view .o_list_table tbody tr:not([style*="background"]){ background-color: var(--t-bg-3); }
.o_list_view .o_list_table tbody tr:not([style*="background"]):hover{ background-color: var(--t-bg-hover); }
.o_list_view .table-striped > tbody > tr:nth-of-type(odd){ background-color: var(--t-bg-4); }
.o_list_view .o_group_header{ background-color: var(--t-bg-4) !important; }
.o_list_view .o_list_table tbody tr.o_data_row > td{
  background: var(--t-bg-2) !important;
  background-image: none !important;
  border-top-color: var(--t-border) !important;
}
.o_list_view .o_list_table tbody tr.o_data_row:hover > td{ background: var(--t-bg-hover) !important; }
.o_list_view.table-striped > tbody > tr.o_data_row:nth-of-type(odd) > td{ background: var(--t-bg-4) !important; }
.o_list_view .o_list_table tr.o_group_header,
.o_list_view .o_list_table tr.o_group_has_content{ background-color: var(--t-bg-4) !important; }
.o_list_view .o_list_table tr.o_group_header > th,
.o_list_view .o_list_table tr.o_group_header > td,
.o_list_view .o_list_table tr.o_group_has_content > th,
.o_list_view .o_list_table tr.o_group_has_content > td{
  background-color: var(--t-bg-4) !important;
  color: var(--t-text) !important;
  border-top: 1px solid var(--t-border) !important;
  border-bottom: 1px solid var(--t-border) !important;
}
.o_list_view .o_data_cell,
.o_list_view .o_data_cell a{ color: inherit !important; }

.o_kanban_view .o_kanban_record{
  background: var(--t-bg-2) !important;
  border: 1px solid var(--t-border) !important;
  box-shadow: var(--t-shadow-card) !important;
}

.o_form_view label,
.o_form_view .o_form_label{ color: var(--t-text) !important; }

input:not([type="checkbox"]):not([type="radio"]),
select,
textarea,
.o_input,
.o_field_widget input,
.o_field_widget textarea,
.o_field_widget select{
  background: var(--t-input-bg) !important;
  color: var(--t-text) !important;
  border-color: var(--t-input-border) !important;
}

.badge,
.o_tag{
  background: var(--t-chip-bg) !important;
  color: var(--t-chip-text) !important;
  border: 1px solid var(--t-chip-border) !important;
}

.btn,
button,
.o_btn,
.o_form_statusbar .btn,
.o_control_panel .btn,
.o_statusbar_status .btn,
.o_statusbar_buttons .btn,
.o_cp_pager .btn,
.o_pager .btn,
.btn-group .btn{ border-radius: 9999px !important; }

.o_control_panel .btn:not(.btn-primary):not(.btn-danger):not(.btn-success),
.o_form_statusbar .btn,
.o_statusbar_status .btn,
.o_statusbar_buttons .btn,
.o_cp_pager .btn,
.o_pager .btn,
.btn-group .btn{
  background-color: var(--t-btn-bg) !important;
  border-color: var(--t-btn-border) !important;
  color: var(--t-text) !important;
}
.o_control_panel .btn:hover,
.o_form_statusbar .btn:hover,
.o_statusbar_status .btn:hover,
.o_statusbar_buttons .btn:hover,
.o_cp_pager .btn:hover,
.o_pager .btn:hover,
.btn-group .btn:hover{
  background-color: var(--t-btn-bg-hover) !important;
  border-color: var(--t-btn-border-hover) !important;
}

.o_control_panel .o_cp_buttons .btn{ background-color: revert !important; border-color: revert !important; }

.btn-primary{
  background: linear-gradient(90deg, var(--t-accent), var(--t-accent-2)) !important;
  border: none !important;
  color:#fff !important;
  box-shadow: 0 0 18px var(--t-accent-glow) !important;
}
.btn-primary:hover{ filter: brightness(1.06); }
.btn-primary:focus,
.btn-primary:focus-visible{
  outline:none !important;
  box-shadow: 0 0 0 2px var(--t-accent-focus), 0 0 18px var(--t-accent-glow) !important;
}

.dropdown-menu,
.o-dropdown-menu,
.o_popover,
.popover{
  background: var(--t-pop-bg) !important;
  color: var(--t-text) !important;
  border: 1px solid var(--t-border) !important;
}
.dropdown-item,
.dropdown-menu a{ color: var(--t-text) !important; }
.dropdown-item:hover,
.dropdown-menu a:hover{ background: color-mix(in srgb, var(--t-accent) 12%, transparent) !important; }

.modal-content,
.o_dialog .modal-content{
  background: var(--t-pop-bg) !important;
  color: var(--t-text) !important;
  border: 1px solid var(--t-border) !important;
  border-radius: 18px !important;
}
.modal-header,
.modal-footer{ border-color: var(--t-border) !important; }
  `.trim();

  const ODOO_LIGHT_SHELL = `
body,
.o_web_client,
.o_action_manager,
.o_action{
  background: var(--t-bg-0) !important;
  color: var(--t-text) !important;
}

.o_content,
.o_form_view,
.o_list_view,
.o_kanban_view{ background: transparent !important; }

header.o_navbar,
.o_main_navbar,
.o_control_panel,
.o_cp_top,
.o_cp_bottom{
  background: var(--t-surface) !important;
  border-color: var(--t-border) !important;
  background-image: none !important;
}

.o_form_sheet_bg{ background: transparent !important; }
.o_form_sheet_bg .o_form_sheet,
.card,
.o_kanban_record,
.o_action_manager{
  background: var(--t-surface) !important;
  border: 1px solid var(--t-border) !important;
  border-radius: var(--t-radius-lg) !important;
  box-shadow: var(--t-shadow-card) !important;
}

.btn,
button,
.o_btn{ border-radius: 999px !important; }

.btn-primary{
  background: linear-gradient(90deg, var(--t-accent), var(--t-accent-2)) !important;
  border: none !important;
  color:#fff !important;
  box-shadow: 0 16px 30px var(--t-accent-glow) !important;
}
.btn-primary:focus,
.btn-primary:focus-visible{
  outline:none !important;
  box-shadow: 0 0 0 2px var(--t-accent-focus), 0 16px 30px var(--t-accent-glow) !important;
}

input:not([type="checkbox"]):not([type="radio"]),
select,
textarea,
.o_input{
  background: var(--t-input-bg) !important;
  color: var(--t-text) !important;
  border-color: var(--t-input-border) !important;
  border-radius: var(--t-radius-md) !important;
}

.o_list_view .o_list_table,
.o_list_view table{
  background: var(--t-surface) !important;
  color: var(--t-text) !important;
}
.o_list_view thead th{
  background: var(--t-surface-2) !important;
  border-color: var(--t-border) !important;
  color: var(--t-text) !important;
}
.o_list_view tbody tr:hover{ background: var(--t-bg-hover) !important; }

.dropdown-menu,
.popover,
.modal-content{
  background: var(--t-surface) !important;
  color: var(--t-text) !important;
  border-color: var(--t-border) !important;
}
  `.trim();

  /** Thèmes disponibles (CSS injecté). */
  const THEMES = {
    default: {
      label: 'Odoo (défaut)',
      css: '',
    },
    redblack_gm: {
      label: 'Rouge vif / Noir (Gamification)',
      css: `
/* =========================
   Rouge vif / Noir — basé sur gm-theme-redblack (gamification.js)
   Objectif: toucher Odoo "partout" (webclient, control panel, forms, lists, kanban, menus, modales).
   ========================= */

/* Palette */
:root{
  --rb-bg-0: #0a0a0a;    /* fond principal */
  --rb-bg-1: #0b0b0b;    /* surfaces */
  --rb-bg-2: #0f0f0f;    /* cartes / feuilles */
  --rb-bg-3: #101010;    /* zones secondaires */
  --rb-border: #1a1a1a;
  --rb-border-2: #232323;
  --rb-text: #f0f0f0;
  --rb-text-2: #eaeef2;
  --rb-muted: #bdbdbd;
  --rb-accent: #ff1a1a;
  --rb-accent-2: #7a0000;
  --rb-accent-soft: rgba(255, 26, 26, .27);
}

/* Base */
body,
.o_web_client,
.o_action_manager,
.o_action{
  background-color: var(--rb-bg-1) !important;
  color: var(--rb-text) !important;
}

/* Conteneurs principaux */
.o_content,
.o_form_view,
.o_list_view,
.o_kanban_view{
  background-color: var(--rb-bg-0) !important;
}

/* Control panel / navbar / breadcrumb */
.o_control_panel{ background-color: var(--rb-bg-1) !important; }
.o_control_panel,
.o_cp_bottom,
.o_cp_top{ border-color: var(--rb-border) !important; background-image:none !important; background-color: var(--rb-bg-1) !important; }

header.o_navbar,
.o_main_navbar{ background-color: var(--rb-bg-1) !important; border-color: var(--rb-border) !important; }

.o_breadcrumb,
ol.breadcrumb{ background-color: var(--rb-bg-2) !important; }

/* Menu apps / sidebar (selon versions Odoo) */
.o_menu_apps,
.o_apps,
.o_main_navbar .o_menu_apps,
.o_navbar_apps_menu,
.o_menu_sections,
.o_menu_systray{
  background-color: var(--rb-bg-1) !important;
  border-color: var(--rb-border) !important;
  color: var(--rb-text) !important;
}

.o_menu_sections .o_menu_entry,
.o_menu_sections .o_menu_entry_lvl_1,
.o_menu_sections .o_menu_entry_lvl_2,
.o_menu_sections .o_menu_entry_lvl_3,
.o_menu_sections a{
  color: var(--rb-text) !important;
}

.o_menu_sections .o_menu_entry:hover,
.o_menu_sections a:hover{
  background: rgba(255, 26, 26, .08) !important;
}

/* Form statusbar */
.o_form_statusbar{
  background: var(--rb-bg-1) !important;
  border-bottom: 1px solid var(--rb-border) !important;
}

/* Form view surfaces */
.o_form_sheet_bg{ background-color: #0e0e0e !important; }
.o_form_sheet_bg .o_form_sheet{ background-color: var(--rb-bg-2) !important; border-color: var(--rb-border) !important; }

.o_form_view .o_form_sheet,
.o_form_view .o_inner_group,
.o_form_view .o_group,
.o_form_view .o_notebook,
.o_form_view .o_chatter{
  background: var(--rb-bg-2) !important;
  color: var(--rb-text) !important;
}

/* Chatter */
.o_Chatter_container,
.o_mail_thread,
.o_thread_window,
.o_MessageList{ background: var(--rb-bg-3) !important; }
.o_mail_thread .o_Message,
.o_attachment_box{ background: var(--rb-bg-2) !important; }

.o_chatterTopbar,
[class^="o_ChatterTopbar"],
[class*=" o_ChatterTopbar"]{
  background: var(--rb-bg-3) !important;
  border-color: var(--rb-border) !important;
}

[class^="o_Chatter"],
[class*=" o_Chatter"],
[class^="o_mail_thread"],
[class*=" o_mail_thread"],
[class^="o_MessageList"],
[class*=" o_MessageList"],
[class^="o_ThreadView"],
[class*=" o_ThreadView"]{
  background: var(--rb-bg-2) !important;
}

/* Notebook / tabs */
.o_notebook .nav-tabs,
.o_notebook_headers .nav.nav-tabs,
ul.nav.nav-tabs.flex-row.flex-nowrap{
  background: #121212 !important;
  border-color: var(--rb-border) !important;
}
.o_notebook .nav-tabs .nav-link.active{
  background: var(--rb-bg-2) !important;
  border-color: var(--rb-border) !important;
  color: var(--rb-text) !important;
}
.o_notebook .nav-tabs .nav-link{
  color: var(--rb-text) !important;
}

/* List view */
.o_list_renderer .o_group_header,
.o_list_renderer .o_group_has_content{
  background: #111111 !important;
  border-bottom: 1px solid var(--rb-border) !important;
}

.o_list_view table,
.o_list_view .table,
.o_list_view .o_list_table{
  background-color: var(--rb-bg-2) !important;
  color: var(--rb-text) !important;
}

.o_list_view thead th,
.o_list_view .o_list_table thead th{
  background: #151515 !important;
  color: #f5f5f5 !important;
  border-color: #1f1f1f !important;
}

.o_list_view tbody tr,
.o_list_view .o_data_row{
  border-color: var(--rb-border) !important;
  background-color: #0f0f10 !important;
}
.o_list_view tbody tr:hover,
.o_list_view .o_data_row:hover{ background: #151115 !important; }

.o_list_view .o_list_table tbody{ background-color: var(--rb-bg-3) !important; }
.o_list_view .o_list_table tbody tr:not([style*="background"]){ background-color: var(--rb-bg-3); }
.o_list_view .o_list_table tbody tr:not([style*="background"]):hover{ background-color:#130a0a; }
.o_list_view .table-striped > tbody > tr:nth-of-type(odd){ background-color:#111111; }
.o_list_view .o_group_header{ background-color:#111111 !important; }

.o_list_view .o_list_table tbody tr.o_data_row > td{
  background: #0f0f10 !important;
  background-image: none !important;
  border-top-color: var(--rb-border) !important;
}
.o_list_view .o_list_table tbody tr.o_data_row:hover > td{ background:#151115 !important; }
.o_list_view.table-striped > tbody > tr.o_data_row:nth-of-type(odd) > td{ background:#111111 !important; }

.o_list_view .o_list_table tr.o_group_header,
.o_list_view .o_list_table tr.o_group_has_content{ background-color:#111111 !important; }
.o_list_view .o_list_table tr.o_group_header > th,
.o_list_view .o_list_table tr.o_group_header > td,
.o_list_view .o_list_table tr.o_group_has_content > th,
.o_list_view .o_list_table tr.o_group_has_content > td{
  background-color:#111111 !important;
  color: var(--rb-text-2) !important;
  border-top: 1px solid var(--rb-border) !important;
  border-bottom: 1px solid var(--rb-border) !important;
}
.o_list_view .o_list_table tr.o_group_header .o_group_name,
.o_list_view .o_list_table tr.o_group_has_content .o_group_name{
  color: var(--rb-text-2) !important;
  font-weight: 700;
}

.o_list_view .o_data_cell,
.o_list_view .o_data_cell a{ color: inherit !important; }

/* Kanban */
.o_kanban_view .o_kanban_record{
  background: var(--rb-bg-2) !important;
  border: 1px solid var(--rb-border) !important;
  box-shadow: 0 6px 18px rgba(255,26,26,0.08);
}

/* Labels / champs */
.o_form_view label,
.o_form_view .o_form_label{ color: #f5f5f5 !important; }

.o_form_view .o_field_widget,
.o_form_view .o_field_widget input,
.o_form_view .o_field_widget textarea{
  color: var(--rb-text) !important;
}

input:not([type="checkbox"]):not([type="radio"]),
select,
textarea,
.o_input,
.o_field_widget input,
.o_field_widget textarea,
.o_field_widget select{
  background: #0f0f10 !important;
  color: var(--rb-text) !important;
  border-color: #1f1f1f !important;
}

/* Badges / tags */
.badge,
.o_tag{
  background: #161111 !important;
  color: #ffbaba !important;
  border: 1px solid rgba(255,26,26,0.27) !important;
}

.o_form_view .o_statusbar_status,
.o_form_view .badge{
  background:#161111 !important;
  color:#ffbaba !important;
  border: 1px solid rgba(255,26,26,0.27) !important;
}

/* Boutons arrondis + cohérence */
.btn,
button,
.o_btn,
.o_form_statusbar .btn,
.o_control_panel .btn,
.o_statusbar_status .btn,
.o_statusbar_buttons .btn,
.o_cp_pager .btn,
.o_pager .btn,
.btn-group .btn{
  border-radius: 9999px !important;
}

/* Boutons secondaires (comme gamification) */
.o_control_panel .btn:not(.btn-primary):not(.btn-danger):not(.btn-success),
.o_form_statusbar .btn,
.o_statusbar_status .btn,
.o_statusbar_buttons .btn,
.o_cp_pager .btn,
.o_pager .btn,
.btn-group .btn{
  background-color: #141414 !important;
  border-color: #1f1f1f !important;
  color: var(--rb-text) !important;
}

.o_control_panel .btn:hover,
.o_form_statusbar .btn:hover,
.o_statusbar_status .btn:hover,
.o_statusbar_buttons .btn:hover,
.o_cp_pager .btn:hover,
.o_pager .btn:hover,
.btn-group .btn:hover{
  background-color:#191919 !important;
  border-color:#242424 !important;
}

.o_control_panel .btn:active,
.o_form_statusbar .btn:active,
.o_statusbar_status .btn:active,
.o_statusbar_buttons .btn:active,
.o_cp_pager .btn:active,
.o_pager .btn:active,
.btn-group .btn:active{
  background-color:#0f0f0f !important;
  border-color: var(--rb-border) !important;
}

/* Ne pas toucher aux boutons principaux du control panel */
.o_control_panel .o_cp_buttons .btn{ background-color: revert !important; border-color: revert !important; }

/* Primary: rouge dégradé (comme gamification) */
.btn-primary{
  background: linear-gradient(90deg, var(--rb-accent), var(--rb-accent-2)) !important;
  border: none !important;
  color:#fff !important;
  box-shadow: 0 0 16px rgba(255,26,26,0.27);
}
.btn-primary:hover{ filter: brightness(1.05); }
.btn-primary:focus,
.btn-primary:focus-visible{ outline:none !important; box-shadow: 0 0 0 2px rgba(255,26,26,0.22), 0 0 16px rgba(255,26,26,0.25) !important; }

/* Statusbar: boutons d'état (plus spécifiques, comme gamification) */
.o_form_statusbar .o_arrow_button,
.o_form_statusbar .btn-secondary{
  background-color:#161616 !important;
  border-color:#232323 !important;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset;
  color: var(--rb-text) !important;
}
.o_form_statusbar .o_arrow_button:hover,
.o_form_statusbar .btn-secondary:hover{
  background-color:#1b1b1b !important;
  border-color:#282828 !important;
}
.o_form_statusbar .o_statusbar_status > .btn{
  background-color:#161616 !important;
  border-color:#232323 !important;
}
.o_form_statusbar .o_statusbar_status > .btn:hover{
  background-color:#1b1b1b !important;
  border-color:#282828 !important;
}

/* Searchview */
.o_searchview{
  background: #121212 !important;
  border-color: var(--rb-border) !important;
  color: var(--rb-text) !important;
}
.o_searchview .o_searchview_input_container,
.o_searchview input{
  color: var(--rb-text) !important;
}
.o_searchview .o_searchview_facet{
  background: rgba(255,26,26,.10) !important;
  border-color: rgba(255,26,26,.22) !important;
  color: var(--rb-text) !important;
}

/* Dropdowns / popovers / modales (ajout pour “tout modifier”) */
.dropdown-menu,
.o-dropdown-menu,
.o_popover,
.popover{
  background: #111111 !important;
  color: var(--rb-text) !important;
  border: 1px solid var(--rb-border) !important;
}
.dropdown-item,
.dropdown-menu a{
  color: var(--rb-text) !important;
}
.dropdown-item:hover,
.dropdown-menu a:hover{
  background: rgba(255,26,26,.10) !important;
}

.modal-content,
.o_dialog .modal-content{
  background: #111111 !important;
  color: var(--rb-text) !important;
  border: 1px solid var(--rb-border) !important;
  border-radius: 18px !important;
}
.modal-header,
.modal-footer{
  border-color: var(--rb-border) !important;
}

/* Scrollbar (Chrome/Edge) */
*::-webkit-scrollbar{ width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb{ background: rgba(255,26,26,.22); border-radius: 999px; border: 2px solid rgba(0,0,0,.35); }
*::-webkit-scrollbar-track{ background: rgba(255,255,255,.03); }
      `.trim(),
    },
    modern: {
      label: 'Moderne (arrondi)',
      css: `
/* =========================
   Odoo Modern Theme (safe-ish)
   Objectif: boutons + champs plus modernes, sans casser la mise en page.
   ========================= */

:root{
  --ots-radius-sm: 10px;
  --ots-radius-md: 14px;
  --ots-radius-lg: 18px;
  --ots-focus: 0 0 0 .2rem rgba(32,156,255,.25);
  --ots-shadow-sm: 0 6px 18px rgba(0,0,0,.10);
  --ots-shadow-xs: 0 2px 10px rgba(0,0,0,.10);
  --ots-border: rgba(0,0,0,.12);
}

/* Boutons (Bootstrap/Odoo) */
button,
.btn,
.o_btn,
.o_form_button_edit,
.o_form_button_save,
.o_form_button_cancel{
  border-radius: 999px !important;
  padding: .55rem 1.0rem !important;
  transition: transform .08s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease, filter .18s ease;
}

.btn:focus,
.btn:focus-visible,
button:focus,
button:focus-visible{
  outline: none !important;
  box-shadow: var(--ots-focus) !important;
}

.btn:hover,
button:hover{
  filter: brightness(1.02);
  box-shadow: var(--ots-shadow-xs);
}

.btn:active,
button:active{
  transform: translateY(1px) scale(.99);
  box-shadow: none;
}

/* Boutons principaux un peu plus “premium” */
.btn-primary,
.o_form_button_save.btn-primary,
.o_control_panel .btn-primary{
  box-shadow: 0 10px 24px rgba(32,156,255,.22);
}

/* Champs / selects */
input:not([type="checkbox"]):not([type="radio"]),
select,
textarea,
.o_input,
.o_field_widget input,
.o_field_widget textarea,
.o_field_widget select{
  border-radius: var(--ots-radius-md) !important;
}

/* Cartes / panneaux (léger) */
.card,
.o_form_sheet_bg .o_form_sheet,
.o_kanban_record,
.o_action_manager{
  border-radius: var(--ots-radius-lg) !important;
}

/* Control panel: chips / filtres */
.o_control_panel .o_cp_buttons .btn,
.o_control_panel .o_cp_searchview .btn,
.o_searchview .o_searchview_more{
  border-radius: 999px !important;
}

/* Petites séparations plus douces */
.o_form_sheet_bg .o_form_sheet{
  box-shadow: var(--ots-shadow-sm);
  border: 1px solid var(--ots-border);
}
      `.trim(),
    },
    pink_girly: {
      label: 'Rose Girly',
      css: `
/* =========================
   Rose Girly (backend Odoo)
   ========================= */

:root{
  --t-bg-0: radial-gradient(1200px 800px at 20% 10%, rgba(255, 140, 198, .22), transparent 60%),
            radial-gradient(1000px 650px at 80% 15%, rgba(255, 200, 235, .26), transparent 55%),
            #fff3f8;
  --t-surface: rgba(255,255,255,.92);
  --t-surface-2: rgba(255, 235, 245, .92);
  --t-border: rgba(255, 105, 180, .22);
  --t-text: #2a0f1d;
  --t-radius-md: 16px;
  --t-radius-lg: 22px;
  --t-shadow-card: 0 14px 34px rgba(255, 105, 180, .10);
  --t-accent: #ff4fa3;
  --t-accent-2: #ff86c8;
  --t-accent-glow: rgba(255, 79, 163, .22);
  --t-accent-focus: rgba(255, 79, 163, .25);
  --t-input-bg: rgba(255,255,255,.96);
  --t-input-border: rgba(255, 105, 180, .22);
  --t-bg-hover: rgba(255, 79, 163, .08);
}

${ODOO_LIGHT_SHELL}

.badge,
.o_tag{
  background: rgba(255, 79, 163, .10) !important;
  color: #8a1b4b !important;
  border-color: rgba(255, 79, 163, .22) !important;
}

.btn:not(.btn-primary):not(.btn-danger):not(.btn-success){
  background: rgba(255,255,255,.92) !important;
  border-color: rgba(255, 105, 180, .22) !important;
  color: #2a0f1d !important;
}
.btn:not(.btn-primary):not(.btn-danger):not(.btn-success):hover{
  background: rgba(255, 235, 245, .92) !important;
}
      `.trim(),
    },
    blueblack: {
      label: 'Bleu électrique / Noir',
      css: `
/* =========================
   Bleu électrique / Noir (full coverage)
   ========================= */
:root{
  --t-bg-0: #0a0d12;
  --t-bg-1: #0b0f14;
  --t-bg-2: #0f141b;
  --t-bg-3: #0c1020;
  --t-bg-4: #101826;
  --t-bg-hover: #152031;
  --t-border: #162232;
  --t-text: #e6edf3;
  --t-accent: #5cc0ff;
  --t-accent-2: #209cff;
  --t-accent-glow: rgba(32,156,255,.30);
  --t-accent-focus: rgba(32,156,255,.22);
  --t-input-bg: #0f141b;
  --t-input-border: #162232;
  --t-chip-bg: rgba(32,156,255,.10);
  --t-chip-text: #dbe8ff;
  --t-chip-border: rgba(32,156,255,.22);
  --t-btn-bg: rgba(255,255,255,.04);
  --t-btn-border: #2a3a56;
  --t-btn-bg-hover: rgba(32,156,255,.08);
  --t-btn-border-hover: #3a5a86;
  --t-pop-bg: #101826;
  --t-shadow-card: 0 10px 26px rgba(0,0,0,.35);
}
${ODOO_DARK_SHELL}
      `.trim(),
    },
    purpleblack: {
      label: 'Violet néon / Noir',
      css: `
/* =========================
   Violet néon / Noir (full coverage)
   ========================= */
:root{
  --t-bg-0: #0a0a10;
  --t-bg-1: #0b0b14;
  --t-bg-2: #10101a;
  --t-bg-3: #0c0c14;
  --t-bg-4: #141426;
  --t-bg-hover: #1b1630;
  --t-border: #22213a;
  --t-text: #efeaff;
  --t-accent: #a855f7;
  --t-accent-2: #ff4fd8;
  --t-accent-glow: rgba(168,85,247,.28);
  --t-accent-focus: rgba(168,85,247,.20);
  --t-input-bg: #10101a;
  --t-input-border: #22213a;
  --t-chip-bg: rgba(168,85,247,.10);
  --t-chip-text: #f1e6ff;
  --t-chip-border: rgba(168,85,247,.22);
  --t-btn-bg: rgba(255,255,255,.04);
  --t-btn-border: #2b2a4f;
  --t-btn-bg-hover: rgba(168,85,247,.10);
  --t-btn-border-hover: #4b3f86;
  --t-pop-bg: #141426;
  --t-shadow-card: 0 10px 28px rgba(0,0,0,.38);
}
${ODOO_DARK_SHELL}
      `.trim(),
    },
    emeraldblack: {
      label: 'Vert émeraude / Noir',
      css: `
/* =========================
   Vert émeraude / Noir (full coverage)
   ========================= */
:root{
  --t-bg-0: #070b0a;
  --t-bg-1: #0a0f0e;
  --t-bg-2: #0f1614;
  --t-bg-3: #0b1110;
  --t-bg-4: #121c19;
  --t-bg-hover: #132420;
  --t-border: #1a2e29;
  --t-text: #e8fff7;
  --t-accent: #22c55e;
  --t-accent-2: #2bd9c9;
  --t-accent-glow: rgba(34,197,94,.22);
  --t-accent-focus: rgba(34,197,94,.18);
  --t-input-bg: #0f1614;
  --t-input-border: #1a2e29;
  --t-chip-bg: rgba(34,197,94,.10);
  --t-chip-text: #dbfff0;
  --t-chip-border: rgba(34,197,94,.20);
  --t-btn-bg: rgba(255,255,255,.04);
  --t-btn-border: #21443a;
  --t-btn-bg-hover: rgba(34,197,94,.10);
  --t-btn-border-hover: #2b6a56;
  --t-pop-bg: #121c19;
  --t-shadow-card: 0 10px 26px rgba(0,0,0,.38);
}
${ODOO_DARK_SHELL}
      `.trim(),
    },
  };

  function getSelectedThemeId() {
    const saved = String(localStorage.getItem(STORAGE_KEY) || '').trim();
    return saved && THEMES[saved] ? saved : 'pink_girly';
  }

  function applyTheme(themeId) {
    const tId = THEMES[themeId] ? themeId : 'pink_girly';
    localStorage.setItem(STORAGE_KEY, tId);

    const themeCss = THEMES[tId].css || '';

    // Petit “scope” pour faciliter debug: ajoute aussi un attribut sur <html>
    document.documentElement.setAttribute('data-ots-theme', tId);
    document.documentElement.setAttribute('data-ots-running', '1');

    // CSS final: (1) CSS du thème (2) CSS du widget selector (toujours)
    const css = [
      themeCss,
      getSwitcherUiCss(),
    ].filter(Boolean).join('\n\n');
    setInjectedCss(css);
    log('Theme appliqué =', tId, 'mode CSS =', cssInjectionState.mode, 'url =', location.href);
  }

  function getSwitcherUiCss() {
    return `
/* ===== Odoo Theme Switcher UI ===== */
#${UI_ID}{
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
}

#${UI_ID} .ots-pill{
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(34,40,49,.88);
  color: #f3f6fa;
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 12px 30px rgba(0,0,0,.28);
  backdrop-filter: blur(10px);
}

#${UI_ID} .ots-title{
  font-weight: 700;
  font-size: 12px;
  letter-spacing: .2px;
  opacity: .92;
  white-space: nowrap;
}

#${UI_ID} select{
  appearance: none;
  border-radius: 999px;
  padding: 8px 34px 8px 12px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.06);
  color: #f3f6fa;
  font-weight: 600;
  cursor: pointer;
}

#${UI_ID} select:focus{
  outline: none;
  box-shadow: 0 0 0 .2rem rgba(32,156,255,.25);
}

#${UI_ID} .ots-chevron{
  position: absolute;
  right: 22px;
  pointer-events: none;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid rgba(243,246,250,.85);
}

#${UI_ID} .ots-selectWrap{
  position: relative;
  display: flex;
  align-items: center;
}

@media (max-width: 520px){
  #${UI_ID}{ right: 10px; bottom: 10px; }
  #${UI_ID} .ots-title{ display:none; }
}
    `.trim();
  }

  function ensureUi() {
    if (document.getElementById(UI_ID)) return;

    const root = document.createElement('div');
    root.id = UI_ID;
    // Styles inline minimalistes pour être visible même si CSP bloque l'injection CSS.
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;';
    root.innerHTML = `
      <div class="ots-pill">
        <div class="ots-title">Thème Odoo</div>
        <div class="ots-selectWrap">
          <select id="ots-theme-select" aria-label="Sélecteur de thème Odoo"></select>
          <div class="ots-chevron"></div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Fallback inline pour le “pill” si CSS non injecté
    const pill = root.querySelector('.ots-pill');
    if (pill && pill instanceof HTMLElement) {
      pill.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:999px;background:rgba(34,40,49,.88);color:#f3f6fa;border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 30px rgba(0,0,0,.28);backdrop-filter:blur(10px);';
    }

    const select = root.querySelector('#ots-theme-select');
    if (!select) return;
    if (select instanceof HTMLElement) {
      select.style.cssText = 'appearance:none;border-radius:999px;padding:8px 34px 8px 12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f3f6fa;font-weight:600;cursor:pointer;';
    }

    // Options
    for (const [id, def] of Object.entries(THEMES)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = def.label;
      select.appendChild(opt);
    }

    // Valeur initiale
    select.value = getSelectedThemeId();

    // Change handler
    select.addEventListener('change', () => {
      applyTheme(select.value);
    });
  }

  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  // Init
  log('Chargé', 'href =', location.href);
  ready(() => {
    // Garde-fou: ne fait rien si ce n'est visiblement pas l'interface Odoo (évite d'impacter d'autres sites).
    // La plupart des backends Odoo ont /web dans l'URL ou des classes .o_web_client.
    const looksLikeOdoo = location.pathname.startsWith('/web') || !!document.querySelector('.o_web_client, .o_main_navbar, .o_control_panel');
    if (!looksLikeOdoo) {
      log('Page ignorée (ne ressemble pas à Odoo backend).');
      return;
    }

    applyTheme(getSelectedThemeId());
    ensureUi();

    // Certains écrans Odoo remplacent le body: on ré-injecte l'UI si besoin.
    const mo = new MutationObserver(() => {
      if (!document.getElementById(UI_ID) && document.body) ensureUi();
      // Assure que le CSS reste présent (Odoo/SPA peut “nettoyer” le head sur certains écrans)
      if (!document.getElementById(STYLE_ID)) {
        applyTheme(getSelectedThemeId());
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
})();

