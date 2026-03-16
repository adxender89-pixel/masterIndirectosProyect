sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    Filter,
    FilterOperator,
    Fragment
) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Corrientes", {

        /**
         * Se obtiene el identificador de la tabla personalizada correspondiente a esta vista.
         */
        getCustomTableId: function () {
            return "TreeTableBasic";
        },

        /**
         * Se inicializa la vista de Corrientes, definiendo el estado de navegación y visibilidad.
         * Se configura la tabla principal y se preparan las columnas anuales iniciales.
         */
        onInit: async function () {
            await this.initCorrienteModel();
            this.tableModelName = "corrientesModel";
            this.firstTime = true;
            
            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            this.setupDynamicTreeTable("TreeTableBasic");
            const oModel = this.getView().getModel();

            if (oModel) {
                this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
            }

            const oTable = this.byId("TreeTableBasic");

            oTable.addEventDelegate({
onAfterRendering: function () {
            // Se obtiene la referencia del Document Object Model (DOM) de la tabla principal.
            const oTableDom = oTable.getDomRef();
            // Se verifica que la tabla exista en el DOM antes de continuar para evitar errores de ejecución en el navegador.
            if (!oTableDom) return;
            
            // Se encapsula el elemento DOM en un objeto jQuery para facilitar la manipulación de eventos estáticos.
            const $table = $(oTableDom);

            // Se gestiona el evento de clic derecho para desplegar el menú contextual personalizado de la aplicación.
            // Se desvincula cualquier evento previo con el mismo nombre para evitar ejecuciones duplicadas y se adjunta el nuevo manejador.
            $table.off("contextmenu").on("contextmenu", function (oNativeEvent) {
                // Se previene la aparición del menú contextual nativo del sistema operativo o navegador web.
                oNativeEvent.preventDefault();
                
                // Se identifica el elemento HTML exacto sobre el cual el usuario ha interactuado.
                const $target = $(oNativeEvent.target);
                // Se recupera el control de interfaz de usuario de SAPUI5 asociado a dicho elemento HTML de bajo nivel.
                const oTargetControl = $target.control(0);
                // Se calcula el índice visual de la fila seleccionada buscando el contenedor padre con la clase correspondiente a las filas.
                const iRowIndex = $target.closest(".sapUiTableTr").index();
                // Se obtiene el contexto de enlace de datos de la fila, sumando el índice visual al índice de la primera fila actualmente visible en pantalla.
                const oRowContext = oTable.getContextByIndex(oTable.getFirstVisibleRow() + iRowIndex);

                // Se valida que la fila tenga un contexto de datos definido antes de invocar la apertura del menú.
 if (oRowContext) {
        const oRowData = oRowContext.getObject();

        // VALIDACIÓN DINÁMICA: Solo si es un nodo raíz (padre)
        if (!oRowData || oRowData.padre !== true) {
            return; 
        }

        // VALIDACIÓN DE COLUMNA: Solo en las columnas de identificación
        const oBindingInfo = oTargetControl && oTargetControl.getBindingInfo ? oTargetControl.getBindingInfo("value") : null;
        const sBindingPath = oBindingInfo && oBindingInfo.parts && oBindingInfo.parts[0] ? oBindingInfo.parts[0].path : null;

        if (sBindingPath !== "PhPspnr" && sBindingPath !== "name") {
            return;
        }   // Se llama a la función interna encargada de procesar la lógica y mostrar el menú contextual en las coordenadas adecuadas.
                    this.onContextMenu({
                        rowBindingContext: oRowContext,
                        cellControl: oTargetControl || oTable
                    });
                }
            }.bind(this));

            // Se gestiona la navegación mediante el teclado dentro de los campos de entrada editables de la tabla.
            $table.off("keydown", "input").on("keydown", "input", function (oNativeEvent) {
                // Se captura el código numérico de la tecla pulsada por el usuario en el teclado físico.
                const iKeyCode = oNativeEvent.keyCode;
                // Se ignora cualquier pulsación que no corresponda estrictamente a las flechas de dirección (códigos del 37 al 40).
                if (iKeyCode < 37 || iKeyCode > 40) return;

                // Se extrae el identificador del control limpiando el sufijo interno autogenerado por el motor de SAPUI5.
                const sControlId = oNativeEvent.target.id.replace("-inner", "");
                // Se recupera la instancia del control mediante el gestor central de la estructura de la interfaz (Core).
                const oInput = sap.ui.getCore().byId(sControlId);
                
                // Se confirma que el control recuperado es efectivamente un campo de entrada de texto válido.
                if (oInput && oInput.isA("sap.m.Input")) {
                    // Se delega el procesamiento del movimiento a una función especializada en administrar la navegación por teclado entre celdas.
                    this._onInputKeyDown({
                        srcControl: oInput,
                        keyCode: iKeyCode,
                        // Se proveen funciones de retrollamada para permitir la cancelación de la propagación del evento nativo si la lógica interna lo requiere.
                        preventDefault: function () { oNativeEvent.preventDefault(); },
                        stopImmediatePropagation: function () { oNativeEvent.stopImmediatePropagation(); }
                    });
                }
            }.bind(this));

            // Se configuran las fechas de referencia y se desencadena la generación de columnas dinámicas únicamente en el primer ciclo de renderizado.
            if (this.firstTime) {
                // Se desactiva la bandera booleana de primer renderizado para que este bloque de configuración no vuelva a ejecutarse en redibujados posteriores.
                this.firstTime = false;

                // Se extraen las propiedades de fecha real y fecha de sistema directamente desde el modelo de datos principal del panel de control.
                const sFreal = this.getView().getModel("dashboardModel").getProperty("/NavMasterLt/0/Freal");
                const sFrealsist = this.getView().getModel("dashboardModel").getProperty("/NavMasterLt/0/Frealsist");

                // Se instancian objetos nativos de tipo Date a partir de las cadenas de texto recuperadas del modelo.
                const oDateFreal = new Date(sFreal);
                const oDateFrealsist = new Date(sFrealsist);

                // Se evalúa mediante una comparación estricta si ambas fechas coinciden exactamente en el mismo día del mes calendario.
                const bSameDay = oDateFreal.getDate() === oDateFrealsist.getDate();

                // Se declara la variable destinada a resguardar el año base para la construcción de la tabla.
                let iYear;

                // Se establece la fecha efectiva de trabajo del controlador dependiendo del resultado de la coincidencia calculada previamente.
                if (bSameDay) {
                    // Si los días coinciden, se utiliza la fecha real tal cual fue entregada y se extrae su componente anual.
                    this._effectiveDate = oDateFreal; 
                    iYear = oDateFreal.getFullYear();
                } else {
                    // Si los días difieren, se genera un nuevo objeto de fecha y se le suma un día completo a la fecha real original.
                    const oDatePlusOne = new Date(oDateFreal);
                    oDatePlusOne.setDate(oDatePlusOne.getDate() + 1);
                    this._effectiveDate = oDatePlusOne;
                    iYear = oDatePlusOne.getFullYear();
                }

                // Se invoca la subrutina responsable de crear las columnas genéricas de los años (por defecto se configuran 3 columnas anuales), pasando el año base calculado.
                this.createYearColumns(iYear, 3, "TreeTableBasic", this.getView().getModel("corrientesModel"));

                // Se introduce un retraso programado para garantizar que la tabla ha completado el renderizado de las columnas anuales antes de proceder a la expansión de los meses.
                setTimeout(function () {
                    // Se obtiene la referencia del componente de la tabla jerárquica mediante su identificador en la vista.
                    const oTableInst = this.byId("TreeTableBasic");
                    if (!oTableInst) return;

                    // Se busca secuencialmente la columna correspondiente al primer año generado, asegurándose de excluir la columna histórica de ejecutados.
                    const oPrimerAnioCol = oTableInst.getColumns().find(function (c) {
                        return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                    });

                    // Se confirma que la columna del primer año ha sido localizada exitosamente en la estructura de la tabla.
                    if (oPrimerAnioCol) {
                        // Se extraen los datos y propiedades personalizadas embebidas en la columna, necesarios para inyectarlos en la función de apertura mensual.
                        const sSubFijo = oPrimerAnioCol.data("subFijoYear");
                        const sYearVal = oPrimerAnioCol.data("year");

                        // Se simula un evento de pulsación de botón pasando un objeto artificial para poder reutilizar limpiamente la lógica estándar de despliegue mensual.
                        this.onCreateMonthsTable({
                            getSource: function () {
                                return {
                                    // Se simula el método de metadatos de un control de botón estándar de la librería SAPUI5.
                                    getMetadata: function () {
                                        return { getName: function () { return "sap.m.Button"; } };
                                    },
                                    // Se expone un método para la recuperación del texto del botón simulado, devolviendo el año procesado.
                                    getText: function () { return String(sYearVal); },
                                    // Se implementa un método de recuperación de datos asociados al control para responder a las solicitudes internas de la función objetivo.
                                    data: function (sKey) {
                                        if (sKey === "subFijoYear") return sSubFijo;
                                        if (sKey === "year") return String(sYearVal);
                                        return null;
                                    }
                                };
                            }
                        });
                    }
                }.bind(this), 150);
            }
            
            // Se adjunta y activa el detector de eventos global para gestionar la visibilidad y el comportamiento dinámico de la cabecera fija de la tabla.
            this._attachHeaderToggleListener();
        }.bind(this)
            });

            const iActualYear = new Date().getFullYear();
            const aSelectYears = [];
            for (let i = 0; i < 10; i++) {
                aSelectYears.push({ year: iActualYear + i });
            }
            
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                years: aSelectYears,
                selectedYear: iActualYear
            }), "yearsModel");

            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);
        },

        /**
         * Se escucha el evento de expansión o colapso de la cabecera principal 
         * para recalcular las filas de la tabla dinámicamente.
         */
        _attachHeaderToggleListener: function () {
            const oObjectPageLayout = this.byId("objectPageLayout");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                const oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                    }.bind(this), 200);
                }.bind(this), true);

            }.bind(this), 1000);
        },

        /**
         * Se crean masivamente nuevos registros en el catálogo.
         * Permite la creación tanto a nivel de raíz como dentro de agrupadores.
         */
  onAddPress: function (oEvent) {
    const oTable = this.byId("TreeTableBasic");
    const oModel = this.getView().getModel("corrientesModel");
    const oBundle = this.getView().getModel("i18n").getResourceBundle();

    // 1. Obtener la cantidad del input (itemQuantityInput)
    let iQuantity = 1;
    const oInput = this.byId("itemQuantityInput");
    if (oInput) {
        iQuantity = parseInt(oInput.getValue()) || 1;
        oInput.setValue(1); // Resetear a 1
    }

    // 2. Determinar el contexto del padre (donde vamos a meter los hijos)
    let oContext = this._oContextRecord || oTable.getContextByIndex(oTable.getSelectedIndex());
    
    if (!oContext) {
        sap.m.MessageToast.show("Seleccione un nivel padre primero");
        return;
    }

    const oParentData = oContext.getObject();
    const iCurrentYear = new Date().getFullYear();

    // 3. Validar que tenga la propiedad 'children' inicializada
    if (!oParentData.children) {
        oParentData.children = [];
    }

    // 4. Bucle para crear la cantidad de filas solicitadas
    for (let k = 0; k < iQuantity; k++) {
        const oNew = {
            PhPspnr: "", 
            name: oParentData.padre === true ? oParentData.name + "." : "", 
            ParentPath: oParentData.PhPspnr, // El ID del padre
            padre: false,
            isGroup: false,
            children: [],
            flag1: false,
            flag2: false,
            amount: "",
            currency: oParentData.currency || "",
            monthsData: {}
        };

        this._fillMonths(oNew, iCurrentYear);
        
        // INSERTAR AL FINAL de los hijos del nodo seleccionado
        oParentData.children.push(oNew);
    }

    // 5. Refrescar el modelo
    oModel.refresh(true);

    // 6. Expandir el nodo para que el usuario vea las nuevas filas al final
    const sPath = oContext.getPath();
    setTimeout(function () {
        const oBinding = oTable.getBinding("rows");
        const iIndex = this._findIndexByPath(oTable, sPath);
        if (iIndex !== -1) {
            oTable.expand(iIndex);
        }
    }.bind(this), 150);

    // Limpieza
    if (this.byId("actionPopover")) {
        this.byId("actionPopover").close();
    }
    this._oContextRecord = null;
    
    sap.m.MessageToast.show(oBundle.getText("msgItemsAdded", [iQuantity]));
},

/**
 * Función auxiliar para encontrar el índice visual de una fila por su path
 */
_findIndexByPath: function (oTable, sPath) {
    const oBinding = oTable.getBinding("rows");
    const aContexts = oBinding.getContexts(0, oBinding.getLength());
    for (let i = 0; i < aContexts.length; i++) {
        if (aContexts[i].getPath() === sPath) {
            return i;
        }
    }
    return -1;
},

        /**
         * Se inicializan las propiedades mensuales y anuales por defecto para un nuevo elemento.
         */
        _fillMonths: function (oItem, iYearStart) {
            oItem.monthsData = {};

            for (let i = 0; i < 3; i++) {
                const iYear = iYearStart + i;
                oItem["y" + iYear] = "";
                
                for (let m = 1; m <= 12; m++) {
                    const sMonthKey = "m" + iYear + "_" + (m < 10 ? "0" + m : m);
                    oItem.monthsData[sMonthKey] = "";
                }
            }
        },

        /**
         * Se fuerza el renderizado y cálculo de elementos una vez que la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            this._attachHeaderToggleListener();
        },

        /**
         * Se gestiona la visibilidad de las columnas extendidas (meses, checkboxes) 
         * al expandir o contraer nodos en la TreeTable.
         */
        onToggleOpenState: function (oEvent) {
            const oTable = oEvent.getSource();
            const sTableId = oTable.getId();
            const bExpanded = oEvent.getParameter("expanded");
            const iRowIndex = oEvent.getParameter("rowIndex");
            const oUiModel = this.getView().getModel("ui");

            const oColMonths = this.byId("colMonths");
            const oColNew = this.byId("colNew");
            const oColCheck1 = this.byId("colCheckBox1");
            const oColCheck2 = this.byId("colCheckBox2");

            const oContext = oTable.getContextByIndex(iRowIndex);
            const sPath = oContext && oContext.getPath();
            const oObject = oContext && oContext.getObject();

            const iLevel = sPath ? (sPath.match(/\/categories/g) || []).length : 0;

            /* Se procesa la expansión del nodo. */
            if (bExpanded) {
                const bIsDetailLevel =
                    iLevel >= 2 &&
                    oObject &&
                    oObject.categories &&
                    oObject.categories.length > 0 &&
                    oObject.categories[0].isGroup === true;

                if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
                if (oColNew) oColNew.setVisible(bIsDetailLevel);
                if (oColCheck1) oColCheck1.setVisible(bIsDetailLevel);
                if (oColCheck2) oColCheck2.setVisible(bIsDetailLevel);

                if (bIsDetailLevel && sPath) {
                    this._sLastExpandedPath = sPath;
                }
            }
            /* Se procesa el colapso del nodo. */
            else {
                if (this._sLastExpandedPath === sPath) {
                    this._sLastExpandedPath = null;
                }

                let bAnyDetailExpanded = false;
                const oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    const iLength = oBinding.getLength();

                    for (let i = 0; i < iLength; i++) {
                        if (oTable.isExpanded(i)) {
                            const oCtx = oTable.getContextByIndex(i);
                            const oObj = oCtx && oCtx.getObject();
                            const sCtxPath = oCtx ? oCtx.getPath() : "";
                            const iCtxLevel = (sCtxPath.match(/\/categories/g) || []).length;

                            if (
                                iCtxLevel >= 2 &&
                                oObj &&
                                oObj.categories &&
                                oObj.categories[0] &&
                                oObj.categories[0].isGroup === true
                            ) {
                                bAnyDetailExpanded = true;
                                break;
                            }
                        }
                    }
                }

                /* Se reinicia la interfaz de usuario si no queda ningún detalle abierto. */
                if (!bAnyDetailExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);
                    if (oColCheck1) oColCheck1.setVisible(false);
                    if (oColCheck2) oColCheck2.setVisible(false);

                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
            }
            
            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this));
        },

        /**
         * Se gestiona el evento de cierre del navegador para advertir sobre posibles cambios sin guardar.
         */
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {
                oEvent.preventDefault();
                oEvent.returnValue = '';
                return '';
            }
        },

        /**
         * Se limpian los escuchadores de eventos activos al destruir el controlador de la vista.
         */
        onExit: function () {
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },

        /**
         * Se inicializa el modelo de datos realizando una petición al servidor OData.
         */
        initCorrienteModel: async function (evt) {
            const sCurrentYear = new Date().getFullYear().toString();
            
            await this.post(
                this.getGlobalModel("mainService"),
                "/CambioPestIndirectosSet",
                {
                    "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                    "NavChanges": [],
                    "NavDatosIndirectos": [],
                    "EvBloqueados": "",
                    "NavMensajes": []
                },
                {
                    headers: {
                        ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                        bloqueado: "",
                        decimales: "02",
                        ejercicio: sCurrentYear,
                        pestana: "Corrientes"
                    }
                }
            ).then(function (response) {
                const tree = this.buildTree(response.NavDatosIndirectos.results);
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "corrientesModel");
            }.bind(this));
        },

        /**
         * Se procesan los datos lineales obtenidos del servicio y se transforman en una estructura de árbol.
         */
        buildTree: function (data) {
            /* Se crea un mapa para el acceso rápido mediante identificadores. */
            const map = {};
            data.forEach(item => {
                map[item.PhPspnr] = { ...item, children: [] };
            });

            const roots = [];

            data.forEach(item => {
                /* Se procesa el nodo raíz. */
                if (item.ParentPath === "I") {

                    // MARCAMOS QUE ES UN NODO RAÍZ
            map[item.PhPspnr].padre = true;
                    if (!roots.some(root => root.PhPspnr === item.PhPspnr)) {
                        roots.push(map[item.PhPspnr]);
                    }
                } else {
                    /* Se procesa el nodo hijo y se asocia con su padre correspondiente. */
                    const parent = map[item.ParentPath];
                    if (parent) {
                        // MARCAMOS QUE ES UN HIJO
                map[item.PhPspnr].padre = false;
                        parent.children.push(map[item.PhPspnr]);
                    }
                }
            });

            return roots;
        }

    });
});