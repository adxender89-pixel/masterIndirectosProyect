# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SAP UI5 1.71+ application called **"Master de Obra Indirectos"** (component id `zindirect_costs`, deploy id `masterindirectos`). It manages indirect-cost master data for construction projects (Ferrovial backend), grouped in five cost categories: **Corrientes, Externos, Diferidos, Anticipados, Inmovilizados**, plus a **Dashboard** summary.

Backend is an SAP OData v2 service at `/sap/opu/odata/SAP/ZFERR_MASTER_SRV/` (proxied via `fiori-tools-proxy` in [ui5.yaml](ui5.yaml) to `fsapl09l.ferrovial.int:8000`).

## Commands

```
npm run start-noflp        # local dev server, opens index.html (preferred for quick iteration)
npm run start              # fiori run with Fiori Launchpad sandbox
npm run start-local        # like start but uses ui5-local.yaml (loads UI5 libs locally)
npm run build              # ui5 build -a --clean-dest (produces dist/)
npm run unit-tests         # QUnit unit tests
npm run int-tests          # OPA5 integration tests
npm run deploy             # fiori verify before deploy
```

User-recurring shortcut: when she says "**apri app**", run `npx ui5 serve --open index.html` in background.

## Architecture

All app code is in [webapp/](webapp/). UI5 standard layout: Component → root view (App) → Main view, with sub-views loaded into the Main view.

```
Component.js               → bootstrap, registers global models (endpointModel, urlsMaster, device)
view/App.view.xml          → root container
view/Main.view.xml         → main shell (header + master/detail layout, sticky headers, ObjectPage)
controller/Main.controller.js (~2400 lines)  → orchestrates view switching, scope selection, save flow
controller/BaseController.js (~11500 lines)  → SHARED logic for all detail views (extends sap.ui.core.mvc.Controller)
controller/DetailsControllers/{Corrientes,Externos,Diferidos,Anticipados,Inmovilizados,Dashboard}.controller.js
  → each extends BaseController; sets `tableModelName` (e.g. "externosModel") and overrides view-specific hooks
view/DetailsViews/*.view.xml → matching XML view per category, mostly sap.ui.table.TreeTable with many t:Column
controller/DialogsControlers/{CambiarMaster,ScopeSelector,UserConfig}.controller.js → modal dialogs
fragments/*.fragment.xml   → reusable XML fragments (popovers, dialogs, value help)
control/                   → custom UI5 controls: DecimalesInput (currency/decimal Input), GraphicBar, GraphicPie
model/                     → static JSON catalogs + formatter.js (binding formatters)
utils/                     → ServiceCaller (fetch/$.ajax wrapper), Odata, Util
i18n/i18n.properties       → ALL labels, ~460 keys
```

### TreeTable + row-type flags

Detail views render a `sap.ui.table.TreeTable` where each row in the model has visibility flags that decide which cell template renders:

- `__isCustom` — flag set true for any row that is part of the "desglose" block (header + editable + sin-proveedor + nieto)
- `__isHeader` — the gray separator row showing column titles inside the desglose (its data fields like `AmoEje: "Ejecutado"` ARE the labels)
- `__isSinProveedor` — calculated "Resto de proveedores" row
- `__isEditable` — any editable desglose row (covers both __isMainEditable and __isNieto)
- `__isMainEditable` — the first empty editable row for entering a new proveedor
- `__isNieto` — child proveedor rows under a main editable
- `__isAgrupadorBlock` / `__isAgrupadorTotal` — agrupador grouping rows
- `cabecera`, `padre`, `isGroup`, `expandible`, `isLevel3` — hierarchy/level flags

Each `<t:Column>` template stacks multiple controls inside a `VBox`, each with `visible="{= ${tableModelName>__isXxx} === true }"` so only one renders per row.

Some columns (`colMonths`, `colNew`, `colCheckBox1`, `colCheckBox2`) are dynamically toggled visible by BaseController on expand/collapse using `this.byId("colMonths").setVisible(...)`. Calls are wrapped in `if (this.byId(...))` so removing a column from a view doesn't crash the controller — it just no-ops.

### Dynamic month columns

Month/year/Resto columns are NOT in the XML view — they are built and inserted at runtime by BaseController helpers (`_buildEjecutadosColumn`, `_buildPanelYearColumn`, etc., around lines 1000–1300 and 9300–9500 of [BaseController.js](webapp/controller/BaseController.js)) using `oTable.insertColumn(...)`. They depend on the cost-period data returned by OData.

### Side panel (proveedor detail)

Externos and similar views split the screen with `sap.ui.layout.Splitter`: TreeTable on the left, a `Panel` with `idPanelTable` on the right (initially hidden via `panelVBox` width 0). The right panel shows extra editable fields (FEE/Tarifa, FINI/FFIN dates, NMES, Otros, PenPlan) for the currently-selected desglose row; bindings go through a separate `panelModel`.

## Conventions

### Comment style for tracked Matteo changes  

The project has an active convention by author Matteo: all lines added or modified must be wrapped in Spanish-language comment markers `   ...    ` with rationale, written in **third-person impersonal Spanish using "se"**, prefix ` `, **never Italian**. Examples already in the codebase: search for `  ` in `webapp/view/DetailsViews/Externos.view.xml`. In XML use `<!--    ...   -->` / `<!--     -->`; in JS use `//    ...  ` and `//    `. Comments document **why**, not what.

### Global models

- `appData` — user/session data (user info, dates Freal/Frealfinobra, locked tabs `EvBloqueados`, etc.), accessed via `this.getGlobalModel("appData")`
- `dashboardModel` — `/decimales` controls decimal places shown
- `modeloBloqueo` — `/isBlocked` gates editability across most inputs
- Per-view models named `corrientesModel`, `externosModel`, etc.; each controller sets `this.tableModelName` so BaseController code uses the correct one

### i18n

All user-visible strings go in [webapp/i18n/i18n.properties](webapp/i18n/i18n.properties). Bindings: `text="{i18n>keyName}"`. There is no second language file at present — keys are in Spanish.

### Editable Input pattern

The custom [control/DecimalesInput.js](webapp/control/DecimalesInput.js) extends `sap.m.Input` with decimal/currency formatting. Notable behavior: on `focusout`, if the user CLEARED a previously non-empty editable cell, the value is forced to `"0,00"`. Non-editable cells and originally-empty cells are left untouched. Change handlers across the codebase use `onRowInputChange`, `onMonthInputChange`, `onEditableRowFieldChange`, `onInputPost1Change`, etc. — they share validation flow in BaseController.

### Linter

Project uses the **UI5plugin VSCode extension** for diagnostics. It is strict about naming patterns (control ids like `idXxxYyyy`, handler names like `onXxxButtonPress`, `onXxxInputChange`) and often flags valid SAP attributes on custom controls (`vn:DecimalesInput`) as "invalid attribute name" — those warnings are spurious and should be ignored unless they coincide with a real attribute name typo.

## Notes

- The repo has a lot of uncommitted work-in-progress on the `matteo` branch — git status is noisy by design.
- No Cursor rules, no Copilot instructions, no README at the time of writing.
- `node_modules/` is tracked; `webapp matteo 10.50.zip` in root is a manual backup, not part of the build.
