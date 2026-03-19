sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "masterindirectos/fragments/MessageDialog.fragment",
    "masterindirectos/fragments/Selector.fragment",
    'sap/m/MessageItem',
    "sap/m/Input",
    'sap/m/MessageView',
    "sap/m/MessageToast",
    'sap/ui/core/IconPool',
    'sap/m/Button',
    'sap/m/Dialog',
    'sap/m/Bar',
    "sap/ui/core/message/Message",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/mvc/XMLView",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/VBox",
    "masterindirectos/utils/ServiceCaller",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox"
], function (
    Controller,
    History,
    JSONModel,
    messageDialog,
    selectorDialog,
    MessageItem,
    Input,
    MessageView,
    MessageToast,
    IconPool,
    Button,
    Dialog,
    Bar,
    Message,
    Filter,
    FilterOperator,
    XMLView,
    Label,
    Text,
    VBox,
    serviceCaller,
    Fragment,
    MessageBox
) {
    "use strict";

    return Controller.extend("masterindirectos.controller.BaseController", {
        // Se define la variable que almacenará la instancia del diálogo de carga para evitar duplicados.
        loadingDialog: null,
        // Se define el nombre del modelo principal de la tabla, que será sobreescrito por las vistas hijas.
        tableModelName: "",

        /**
         * Se obtiene la ruta de enlace (binding) basada en el nombre del modelo.
         */
        getBind: function (sField) {
            // Se concatena el nombre del modelo (si existe) seguido de ">" y el campo solicitado para el data binding.
            return "{" + (this.tableModelName ? this.tableModelName + ">" : "") + sField + "}";
        },

        /**
         * Se obtienen los datos del modelo de endpoint.
         */
        getEndpointData: function () {
            // Se accede al componente principal de la aplicación para extraer los datos completos del modelo "endpointModel".
            return this.getOwnerComponent().getModel("endpointModel").getData();
        },

        /**
         * Se muestra el diálogo de carga.
         */
        _showLoadingDialog: function () {
            // Se comprueba si el diálogo ya ha sido instanciado previamente para no superponer múltiples diálogos.
            if (!this.loadingDialog) {
                // Se crea y asigna la instancia del diálogo utilizando textos traducidos.
                this.loadingDialog = this.createMessageDialog({
                    title: this.getTranslatedText("CARGANDO_DATOS"),
                    messages: [{
                        text: this.getTranslatedText("ESPERE_POR_FAVOR"),
                        type: "Information",
                        showIcon: false
                    }]
                });
            }
        },

        /**
         * Se oculta y destruye el diálogo de carga.
         */
        _hideLoadingDialog: function () {
            // Se verifica que el diálogo exista antes de intentar destruirlo.
            if (this.loadingDialog) {
                // Se destruye el control para liberar memoria y evitar fugas en la interfaz.
                this.loadingDialog.destroy();
                // Se reinicia la variable a nulo para permitir futuras instanciaciones.
                this.loadingDialog = null;
            }
        },

        /**
         * Se realiza una petición GET al servidor OData.
         */
        get: async function (oModel, sPath, oParams = {}) {
            // Se despliega el bloqueo de pantalla mientras se resuelve la petición.
            this._showLoadingDialog();

            // Se retorna una promesa para manejar la asincronía del backend.
            return new Promise((resolve, reject) => {
                // Se ejecuta el método de lectura estándar del modelo OData de SAPUI5.
                oModel.read(sPath, {
                    ...oParams,
                    // Se resuelve la promesa y se oculta el diálogo en caso de éxito.
                    success: function (data) {
                        resolve(data);
                        this._hideLoadingDialog();
                    }.bind(this),
                    // Se rechaza la promesa propagando el error y se oculta el diálogo en caso de fallo.
                    error: function (error) {
                        reject(error);
                        this._hideLoadingDialog();
                    }.bind(this),
                });
            });
        },

        /**
         * Se realiza una petición POST al servidor OData.
         */
        post: async function (oModel, sPath, oData, oParams = {}) {
            // Se activa el indicador visual de carga de datos.
            this._showLoadingDialog();

            // Se envuelve la llamada de creación en una promesa.
            return new Promise((resolve, reject) => {
                // Se inyectan los datos al path especificado en el modelo OData.
                oModel.create(sPath, oData, {
                    ...oParams,
                    // Se finaliza la promesa de forma exitosa y se retira el bloqueo de pantalla.
                    success: function (data) {
                        resolve(data);
                        this._hideLoadingDialog();
                    }.bind(this),
                    // Se captura la excepción, se rechaza la promesa y se desbloquea la pantalla.
                    error: function (error) {
                        reject(error);
                        this._hideLoadingDialog();
                    }.bind(this),
                });
            });
        },

        /**
         * Se realiza una llamada a un servicio externo genérico.
         */
        callExternalService: async function (url, method = "GET", data = null, headers = {}) {
            // Se procesa la llamada asíncrona mediante el utilitario 'serviceCaller'.
            return new Promise((resolve, reject) => {
                serviceCaller.callService(url, method, data, headers)
                    // Se mapea la respuesta exitosa directamente al 'resolve'.
                    .then(response => resolve(response))
                    // Se traslada cualquier excepción al 'reject' de la promesa superior.
                    .catch(error => reject(error));
            });
        },

        /** * Se obtiene el enrutador de la aplicación.
         */
        getRouter: function () {
            // Se recupera la instancia del router desde el contexto del componente global.
            return this.getOwnerComponent().getRouter();
        },

        /** * Se obtiene el modelo asociado a la vista actual.
         */
        getModel: function (sName) {
            // Se retorna el modelo especificado ligado al ciclo de vida de la vista actual.
            return this.getView().getModel(sName);
        },

        /** * Se establece un modelo a nivel global (Componente).
         */
        setGlobalModel: function (oModel, sName) {
            // Se asigna el modelo en la raíz de la aplicación para que esté disponible en todas las vistas.
            return this.getOwnerComponent().setModel(oModel, sName);
        },

        /** * Se obtiene un modelo a nivel global (Componente).
         */
        getGlobalModel: function (sName) {
            // Se accede a la raíz de la aplicación para recuperar un modelo global.
            return this.getOwnerComponent().getModel(sName);
        },

        /** * Se establece un modelo a nivel local (Vista).
         */
        setModel: function (oModel, sName) {
            // Se vincula un nuevo modelo únicamente al alcance de la vista desde donde se llama.
            return this.getView().setModel(oModel, sName);
        },

        /** * Se obtiene el paquete de recursos (i18n) para traducciones.
         */
        getResourceBundle: function () {
            // Se rescata el modelo de internacionalización y se extrae su ResourceBundle nativo.
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /** * Se gestiona la navegación hacia atrás en el historial.
         */
        onNavBack: function () {
            // Se consulta el historial interno de UI5 para verificar si existe una página anterior.
            const sPreviousHash = History.getInstance().getPreviousHash();

            // Si hay un hash previo válido, se retrocede en el historial nativo del navegador.
            if (sPreviousHash !== undefined) {
                history.go(-1);
            } else {
                // Si se ha entrado a la app directamente por un enlace profundo (sin historial), se fuerza la navegación a la vista 'master'.
                this.getRouter().navTo("master", {}, true);
            }
        },

        /**
         * Se obtiene el segundo año visible en la tabla. Función auxiliar para el cálculo de rangos.
         */
        _getSecondVisibleYear: function () {
            // Se recupera la instancia de la tabla que está siendo operada en el controlador.
            const oTable = this.getControlTable();

            // Se extraen todas las columnas y se filtran buscando solo aquellas de tipo 'dynamicYear' y descartando las de 'ejecutados'.
            const aDynYears = oTable.getColumns().filter(function (c) {
                return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
            });

            // Se evalúa si hay al menos dos años renderizados. Si los hay, se retorna el año de la segunda columna; de lo contrario, se suma 1 al año actual.
            return aDynYears.length >= 2 ? aDynYears[1].data("year") : new Date().getFullYear() + 1;
        },

        /**
         * Se construye la estructura de la columna 'Ejercicios Anteriores' de forma dinámica.
         */
        _buildEjecutadosColumn: function (bAsDynamicMonth, iYear) {
            let oLabel;

            // Se calcula el año actual para formar la cabecera (Ej: "2024-") de forma dinámica y evitar hardcodeos.
            // const sCurrentYearText = new Date().getFullYear().toString() + "-";
            // Se extrae la cadena de texto traducida o se aplica un valor de respaldo por seguridad.
            const sEjerciciosAnterioresText = this.getResourceBundle().getText("EJERCICIOS_ANTERIORES") || "Ejercicios anteriores";

            // Se construye la cabecera compleja si la columna debe comportarse con desglose mensual.
            if (bAsDynamicMonth) {
                // Se anidan VBoxes para soportar los títulos principales, subtítulos y los elementos sticky headers.
                oLabel = new sap.m.VBox({
                    width: "100%",
                    items: [
                        // Primera línea de la cabecera (Ej: "2024-2025")
                        // new sap.m.Text({
                        //     text: sCurrentYearText + iYear
                        // }).addStyleClass("sapUiTinyFontSize textoaño"),
                        // Segunda línea: Título principal en negrita.
                        new sap.m.Label({
                            text: sEjerciciosAnterioresText,
                            design: "Bold",
                            textAlign: "Center",
                            width: "100%"
                        }).addStyleClass("testBold titleGrande"),
                        // Tercera línea: Contenedor para la etiqueta fija (sticky parent) que se muestra al hacer scroll.
                        new sap.m.VBox({
                            renderType: "Bare",
                            width: "100%",
                            visible: "{ui>/showStickyParent}",
                            items: [
                                new sap.m.Text({
                                    text: "{ui>/stickyHeaderData/parent/ejecutado}",
                                    wrapping: false,
                                    width: "100%",
                                    textAlign: "Center"
                                })
                            ]
                        }).addStyleClass("parentHeaderBox"),
                        // Cuarta línea: Contenedor para el subnivel stick, normalmente invisible para este tipo específico de columna.
                        new sap.m.VBox({
                            width: "100%",
                            items: [
                                new sap.m.Text({
                                    text: "\u00a0",
                                    wrapping: false,
                                    visible: "{ui>/showStickyChild}"
                                }).addStyleClass("secondStickyText")
                            ]
                        }).addStyleClass("parentHeader")
                    ]
                }).addStyleClass("fullWidthHeader").addStyleClass("noPaddingTop").addStyleClass("borderLeftEjecutado");
            } else {
                // Se construye una cabecera simplificada si solo representa un año cerrado sin meses.
                oLabel = new sap.m.VBox({
                    alignItems: "Center",
                    renderType: "Bare",
                    width: "100%",
                    items: [
                        // new sap.m.Text({
                        //     text: sCurrentYearText + iYear
                        // }).addStyleClass("sapUiTinyFontSize textoaño"),
                        new sap.m.Label({
                            text: sEjerciciosAnterioresText,
                            design: "Bold",
                            textAlign: "Center",
                            width: "100%"
                        }).addStyleClass("testBold titleGrande")
                    ]
                }).addStyleClass("borderLeftEjecutado");
            }

            // Se instancia finalmente la columna de SAPUI5 acoplando el Label creado y su template de celdas de datos.
            const oCol = new sap.ui.table.Column({
                width: "130px",
                hAlign: "Center",
                label: oLabel,
                // Se mapea la celda interna contra la propiedad "InvEjeReal" del modelo base.
                template: new sap.m.HBox({
                    renderType: "Bare",
                    justifyContent: "Center",
                    alignItems: "Center",
                    width: "100%",
                    items: [new sap.m.Text({
                        text: this.getBind("InvEjeReal"),
                        textAlign: "Center",
                        width: "100%"
                    })]
                }).addStyleClass("borderLeftEjecutado")
            });

            // Se etiquetan datos customizados en la columna (CustomData) para que el controlador pueda identificarlas fácilmente durante la limpieza o búsquedas.
            if (bAsDynamicMonth) {
                oCol.data("dynamicMonth", true);
            } else {
                oCol.data("dynamicYear", true);
            }
            oCol.data("ejecutadosColumn", true);

            return oCol;
        },

        /**
         * Se crean masivamente y dinámicamente las columnas base de cada año.
         */
        createYearColumns: function (iStartYear, iHowMany, _pTable) {
            // Se recupera la tabla a manipular.
            const oTable = this.getControlTable();
            if (!oTable) return;

            // Se extraen las columnas actuales y se iteran de atrás hacia adelante para evitar saltos de índice al eliminarlas.
            const aColumns = oTable.getColumns();
            for (let i = aColumns.length - 1; i >= 0; i--) {
                const oCol = aColumns[i];
                // Se suprimen todas las columnas anuales creadas previamente para garantizar un renderizado limpio.
                if (oCol.data("dynamicYear") === true) {
                    oTable.removeColumn(oCol);
                }
            }

            // Se establece un offset numérico para leer propiedades específicas de los objetos (Totala1, Totala2, etc.) en los formateadores.
            const iStartFrom = 13;
            // Se comprueba el estado del control de "Ejecutados" para saber si hay que incluir dicha columna especial.
            const bShowEjecutado = this._bEjecutadoSelected || false;

            // Si está marcado, se inyecta la columna de ejercicios históricos al principio.
            if (bShowEjecutado) {
                oTable.addColumn(this._buildEjecutadosColumn(false, new Date().getFullYear()));
            }

            // Se genera un arreglo con los años numéricos exactos que se van a generar en pantalla.
            const aYears = [];
            for (let i = 0; i < iHowMany; i++) {
                aYears.push(iStartYear + i);
            }

            // Se procesa de forma individual cada año solicitado para ensamblar su columna.
            aYears.forEach(function (iYear, index) {
                // Se prepara el sufijo del modelo (Ej: "a1", "a2") para relacionar la columna lógica con la clave de la base de datos.
                const sSubFijo = "a" + (index + 1);
                // Se genera la ruta de binding dinámica que leerá el Total anual.
                const sTotalTextBinding = "{" + this.tableModelName + ">Total" + sSubFijo + "}";

                // Se construye el bloque de etiqueta que incluye el botón para desplegar meses y los elementos sticks.
                const oYearLabel = new sap.m.VBox({
                    width: "100%",
                    height: "100%",
                    renderType: "Bare",
                    alignItems: "Stretch",
                    justifyContent: "Start",
                    items: [
                        // Botón principal de la cabecera que muestra el año y dispara el desglose mensual.
                        new sap.m.Button({
                            text: iYear.toString(),
                            type: "Transparent",
                            width: "100%",
                            press: function (oEvent) {
                                this.onCreateMonthsTable(oEvent);
                            }.bind(this)
                        }).addStyleClass("yearButton").addStyleClass("nopadding").data("subFijoYear", sSubFijo),

                        // Elemento contenedor que aparece fijado (sticky) mostrando los totales consolidados cuando se hace scroll hacia abajo.
                        new sap.m.VBox({
                            renderType: "Bare",
                            width: "100%",
                            visible: "{ui>/showStickyParent}",
                            items: [
                                new sap.m.Text({
                                    text: "{ui>/stickyHeaderData/parent/y" + iYear + "}",
                                    textAlign: "Center",
                                    wrapping: false,
                                    width: "100%"
                                })
                            ]
                        }).addStyleClass("parentHeaderBox"),

                        // Elemento contenedor para el sub-nivel fijo (sticky child).
                        new sap.m.VBox({
                            width: "100%",
                            visible: "{ui>/showStickyChild}",
                            items: [
                                new sap.m.Text({
                                    text: "{ui>/stickyHeaderData/child/y" + iYear + "}",
                                    wrapping: false
                                }).addStyleClass("secondStickyText checkboxStickyText")
                            ]
                        }).addStyleClass("parentHeader")
                    ]
                }).addStyleClass("fullWidthHeader");

                // Se evalúa dinámicamente si la fila de datos es un agrupador o un registro operable mediante un string literal evaluable.
                const sCabeceraBinding = this.tableModelName ? "${" + this.tableModelName + ">cabecera}" : "${cabecera}";

                // Se diseña la celda interior que mostrará los datos o el input en base a la jerarquía de la TreeTable.
                const oColumnTemplate = new sap.m.HBox({
                    renderType: "Bare",
                    justifyContent: "Center",
                    alignItems: "Center",
                    // La celda general solo es visible si la fila NO es una cabecera organizativa.
                    visible: "{= " + sCabeceraBinding + " !== true }",
                    items: [
                        // Campo editable para introducir datos manuales. Se oculta automáticamente si la fila no es de detalle puro.
                        new sap.m.Input({
                            width: "100%",
                            textAlign: "Center",
                            value: "{" + this.tableModelName + ">Totala" + (parseInt(index) + 1) + "}",
                            visible: "{= ${" + this.tableModelName + ">expandible} !== false && !${" + this.tableModelName + ">isGroup} && ${" + this.tableModelName + ">cabecera} !== true }",
                            liveChange: function () { }
                        }).addStyleClass("customYearInput sapUiSizeCompact"),

                        // Texto de solo lectura para los nodos padres (agrupadores) donde los totales no son editables directamente.
                        new sap.m.Text({
                            width: "100%",
                            textAlign: "Center",
                            visible: "{= ${" + this.tableModelName + ">expandible} === false || ${" + this.tableModelName + ">isGroup} === true }",
                            wrapping: false,
                            text: {
                                path: this.tableModelName + ">Totala" + (parseInt(index) + 1),
                                // Formateador dinámico que asegura que no se presenten valores incoherentes en los nodos editables al colapsar.
                                formatter: function (oRow) {
                                    if (!oRow || (oRow.expandible !== false && !oRow.isGroup)) return "";
                                    const aKeys = Object.keys(oRow);
                                    const sTargetKey = aKeys[iStartFrom + index];
                                    return sTargetKey ? oRow[sTargetKey] : "";
                                }
                            }
                        })
                    ]
                }).addStyleClass("yearCell sapUiTinyMarginBegin sapUiTinyMarginEnd");

                // Se empaqueta la lógica construida en una instancia real de columna para SAPUI5.
                const oCol = new sap.ui.table.Column({
                    width: "8rem",
                    minWidth: 60,
                    autoResizable: true,
                    label: oYearLabel,
                    template: oColumnTemplate
                });

                // Se asocian las etiquetas para poder localizar la columna rápidamente en otros ciclos de renderizado.
                oCol.data("dynamicYear", true);
                oCol.data("year", iYear);
                oCol.data("subFijoYear", "a" + (parseInt(index) + 1));

                // Se adjunta la nueva columna al final del array de columnas de la tabla principal.
                oTable.addColumn(oCol);

            }.bind(this));

            // Se envía a la cola del procesador la función de reactivar la lógica interna del scroll y los grupos en la TreeTable.
            setTimeout(function () {
                this.setupDynamicTreeTable();
            }.bind(this), 0);
            
        },

        /**
         * Se reajusta toda la estructura de columnas cuando el usuario selecciona un año diferente en el control desplegable (Select).
         */
        onYearChange: function (oEvent) {
            // Se recupera la instancia del selector desplegable.
            const oSelect = oEvent.getSource();
            // Se toman los elementos de la lista desplegable.
            const aItems = oSelect.getItems();
            // Se parsea a número entero el año elegido por el usuario.
            const sSelectedYear = parseInt(oEvent.getParameter("selectedItem").getKey(), 10);
            // Se determina cuál es el año máximo cargado en las opciones para evitar desbordes.
            const iMaxYearInSelect = parseInt(aItems[aItems.length - 1].getKey(), 10);

            // Se establece el límite estricto de columnas anuales visibles de forma simultánea.
            const iNumColumns = 3;
            // Se calcula qué año de inicio renderizar asegurando que siempre se muestren las columnas necesarias (incluso si se elige el final del rango).
            const iYearToPass = Math.min(sSelectedYear, iMaxYearInSelect - (iNumColumns - 1));
            const oTable = this.getControlTable();
            // Se verifica si al momento del cambio, un mes estaba expandido.
            const bWasYearOpen = !!this._openedYear;
            const bShowEjecutado = this._bEjecutadoSelected || false;

            // Si hay un nivel de detalle mensual abierto, se procede a desmantelarlo temporalmente.
            if (this._openedYear && oTable) {
                // Se buscan las columnas de meses y ejercicios pasados.
                const monthColsToRemove = oTable.getColumns().filter(function (c) {
                    return c.data("dynamicMonth") || c.data("ejecutadosColumn");
                });
                // Se suprimen una a una de la tabla en el DOM.
                monthColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                // Se evalúa si es necesario reinserter la columna general de ejercicios consolidados.
                if (bShowEjecutado) {
                    const iInsertIndex = oTable.getColumns().findIndex(function (c) {
                        return c.data("dynamicYear") === true;
                    });
                    if (iInsertIndex !== -1) {
                        oTable.insertColumn(
                            this._buildEjecutadosColumn(false, new Date().getFullYear()),
                            iInsertIndex
                        );
                    }
                }
                // Se libera la marca de año abierto.
                this._openedYear = null;
            }

            // Se realiza la llamada a la construcción masiva de años con el nuevo cálculo base.
            this.createYearColumns(iYearToPass, iNumColumns);

            // Si originalmente el año estaba desgajado en meses, se intenta replicar ese estado simulando el click del usuario en el nuevo año.
            if (bWasYearOpen) {
                setTimeout(function () {
                    // Se ubica la columna concreta del año objetivo basándose en el texto de su etiqueta.
                    const oYearCol = oTable.getColumns().find(function (c) {
                        const lab = c.getLabel();
                        const txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                        return txt === String(sSelectedYear);
                    });

                    if (oYearCol) {
                        // Se simula un objeto evento apuntando a la etiqueta del año para invocar el despliegue mensual de forma automatizada.
                        const oButton = oYearCol.getLabel();
                        this.onCreateMonthsTable({
                            getSource: function () { return oButton; }
                        });
                    }
                }.bind(this), 100);
            }
        },

        /**
         * Se fuerzan los recálculos visuales de grupos y scroll después de modificar la topología de la tabla (abrir o cerrar un nodo).
         */
        _refreshAfterToggle: function (sTableId) {
            // Se obtiene la instancia específica de la tabla mediante su ID.
            const oTable = this.byId(sTableId);
            if (!oTable) return;

            // Se mapean de nuevo los inicios y fines de cada grupo padre frente a sus hijos en el DOM.
            this._buildGroupRanges();

            // Se dispara manualmente el evento de scroll simulando que la tabla se ha movido para reposicionar las cabeceras pegajosas (sticky headers).
            this._onScrollLike({
                getParameter: function () {
                    return oTable.getFirstVisibleRow();
                }
            });

            // Se vuelven a evaluar e inyectar las clases de color de fondo a las nuevas cabeceras visibles.
            this._applyCabeceraStyle();
        },

        /**
         * Se procesan individualmente las filas renderizadas para asignarles clases CSS específicas en función de su naturaleza jerárquica.
         */
        _applyCabeceraStyle: function () {
            const oTable = this.getControlTable();
            // Se recoge la posición de la primera fila renderizada en el canvas actual de la tabla.
            const iFirst = oTable.getFirstVisibleRow();
            // Se recogen los objetos de las filas visuales actuales (elementos DOM de UI5, no los datos del modelo).
            const aRows = oTable.getRows();

            // Se itera sobre todas las filas que el navegador está pintando en ese momento.
            for (let i = 0; i < aRows.length; i++) {
                const oRow = aRows[i];
                // Se limpian los estilos de la iteración anterior para evitar que filas recicladas mantengan colores erróneos.
                oRow.removeStyleClass("cabeceracolor");
                oRow.removeStyleClass("cabeceracolor-Group");

                // Se extrae el contexto de datos vinculado a la fila real sumando el índice base (iFirst) más el índice del bucle.
                const oCtx = oTable.getContextByIndex(iFirst + i);
                if (!oCtx) continue;

                // Se obtiene el objeto JavaScript subyacente de la fila.
                const oObj = oCtx.getObject();

                // Si el objeto contiene la bandera de ser una "cabecera" estructural, se pinta su fondo gris oscuro.
                if (oObj && oObj.cabecera === true) {
                    oRow.addStyleClass("cabeceracolor");
                    // Se quita la apariencia plana de los inputs para mantener el formato estricto del diseño.
                    oRow.removeStyleClass("flatCellInput");
                }

                // Si la fila pertenece a un nivel superior pero con capacidad de desplegarse, se pinta con los estilos de grupo secundario (bordes y colores).
                if (oObj && oObj.expandible === true) {
                    oRow.addStyleClass("cabeceracolor-Group");
                }
            }
        },

        /**
                 * Se gestiona la apertura global del menú contextual (Popover).
                 */
        onContextMenu: function (oParams) {
            // Se extrae el contexto de datos de la fila sobre la que se ha hecho clic derecho.
            const oRowContext = oParams.rowBindingContext;
            // Se identifica el control visual exacto (celda) que originó el evento.
            const oOriginControl = oParams.cellControl;
            // Se obtiene la referencia a la vista actual para poder anclar el fragmento.
            const oView = this.getView();

            // Se guarda una referencia global del contexto para que las acciones (Añadir, Eliminar) sepan sobre qué fila operar.
            this._oContextRecord = oRowContext;

            // Se verifica si el Popover (menú emergente) ya ha sido instanciado previamente en memoria.
            if (!this._pPopover) {
                // Si no existe, se carga asíncronamente el fragmento XML que contiene el diseño del menú.
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "masterindirectos.fragments.ActionPopover",
                    controller: this
                }).then(function (oPopover) {
                    // Se añade el popover como dependiente de la vista para que herede sus modelos y ciclo de vida.
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }

            // Una vez garantizada la existencia del Popover, se procede a su apertura.
            this._pPopover.then(function (oPopover) {
                // Se vincula el contexto de la fila al popover para que los botones sepan si están actuando sobre un nodo padre o hijo.
                oPopover.setBindingContext(oRowContext, "catalog");

                // Se aplica un ligero retraso para asegurar que el motor de renderizado posicione correctamente el menú junto al cursor.
                setTimeout(function () {
                    oPopover.openBy(oOriginControl);
                }, 50);
            });
        },

        /**
         * Se cierra el popover de forma global.
         */
        onCloseContextMenu: function () {
            // Se comprueba que la promesa del popover exista.
            if (this._pPopover) {
                // Se resuelve la promesa y se ejecuta el método de cierre nativo del control.
                this._pPopover.then(function (oPopover) {
                    oPopover.close();
                });
            }
        },

        /**
                 * Se generan las columnas mensuales correspondientes al año seleccionado en la cabecera.
                 * Se garantiza que el mes en curso mantenga su campo de entrada (Input) incluso con ejecutados activos.
                 */
        onCreateMonthsTable: function (oEvent) {
            const oSource = oEvent.getSource();
            const subFijoYear = oSource.data("subFijoYear");
            const oTable = this.getControlTable();
            const bShowEjecutado = this._bEjecutadoSelected || false;

            let iCurrentScrollLeft = 0;
            try {
                const oScrollExt = oTable._getScrollExtension();
                if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                    iCurrentScrollLeft = oScrollExt.getHorizontalScrollbar().scrollLeft;
                }
            } catch (e) { }

            let sYearText = "";
            const sSourceName = oSource.getMetadata().getName();

            if (sSourceName === "sap.m.Button") {
                sYearText = oSource.data("year") || oSource.getText();
                if (isNaN(parseInt(sYearText, 10))) {
                    sYearText = oSource.getParent().getItems()[0].getText();
                }
            } else {
                sYearText = String(this._openedYear);
            }

            const sYear = parseInt(sYearText, 10);
            if (!sYear) return;

            // Caso de cierre de año abierto
            if (this._openedYear === sYear && sSourceName === "sap.m.Button") {
                this._openedYear = null;
                oTable.setBusy(true);
                const monthColsToRemove = oTable.getColumns().filter(function (c) {
                    return c.data("dynamicMonth");
                });
                monthColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                if (bShowEjecutado) {
                    const ejecutadosColsToRemove = oTable.getColumns().filter(function (c) {
                        return c.data("ejecutadosColumn");
                    });
                    ejecutadosColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                    const iInsertIndex = oTable.getColumns().findIndex(function (c) {
                        return c.data("dynamicYear") === true;
                    });

                    if (iInsertIndex !== -1) {
                        oTable.insertColumn(this._buildEjecutadosColumn(false, new Date().getFullYear()), iInsertIndex);
                    }
                }

                setTimeout(function () {
                    try {
                        const oScrollExt = oTable._getScrollExtension();
                        if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                            oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                        }
                    } catch (e) { }
                    oTable.setBusy(false);
                }.bind(this), 50);
                return;
            }

            // Caso de apertura de año
            oTable.setBusy(true);
            const colsToRemove = oTable.getColumns().filter(function (c) {
                return c.data("dynamicMonth") || c.data("ejecutadosColumn");
            });
            colsToRemove.forEach(function (c) { oTable.removeColumn(c); });

            this._openedYear = sYear;

            const aMonthNames = [];
            for (let i = 0; i < 12; i++) {
                const date = new Date(new Date().getFullYear(), i, 1);
                aMonthNames.push(date.toLocaleString("es-ES", { month: "short" }));
            }

            const oRefDate = this._effectiveDate || new Date();
            const currentYear = oRefDate.getFullYear();
            const currentMonth = oRefDate.getMonth();

            const iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth : 0;

            const oYearCol = oTable.getColumns().find(function (c) {
                const lab = c.getLabel();
                const txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                return txt === String(sYear);
            });
            const colIndex = oTable.indexOfColumn(oYearCol);

            let iOffset = 0;
            if (bShowEjecutado) {
                oTable.insertColumn(this._buildEjecutadosColumn(true, sYear), colIndex + iOffset);
                iOffset++;
            }

            for (let i = iStartIdx; i < 12; i++) {
                const sMonthLabel = aMonthNames[i];
                const iRealIdx = i;

                // CAMBIO CRÍTICO: Se utiliza el operador < en lugar de <= para que el mes actual sea editable.
                const bIsPassedMonth = (sYear < currentYear) || (sYear === currentYear && i < currentMonth);

                let oControlTemplate;

                if (bShowEjecutado && bIsPassedMonth) {
                    const sMonthKey = (i + 1).toString().padStart(2, '0');
                    const oText = new sap.m.Text({
                        text: this.getBind("Val" + sMonthKey + subFijoYear),
                        textAlign: "Center",
                        width: "100%"
                    });

                    oControlTemplate = new sap.m.HBox({
                        renderType: "Bare",
                        justifyContent: "Center",
                        alignItems: "Center",
                        items: [oText]
                    }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginEnd");

                } else {
                    oControlTemplate = (function (iIdx, iYr) {
                        const sMonthKey = (iIdx + 1).toString().padStart(2, '0');
                        const oInput = new sap.m.Input({
                            width: "100%",
                            value: this.getBind("Val0" + ((i + 1).toString().length == 1 ? "0" + (i + 1) : (i + 1).toString()) + subFijoYear),
                            textAlign: "Center",
                            visible: "{= ${expandible} !== false && !${isGroup} }",
                            change: function (oEvt) {
                                const oInp = oEvt.getSource();
                                const oCtx = oInp.getBindingContext();
                                const oModel = oCtx.getModel();
                                const sPath = oCtx.getPath();
                                oModel.setProperty(sPath + "/m" + iYr + "_" + iIdx, oInp.getValue());

                                const oUiModel = this.getView().getModel("ui");
                                const oCurrentParent = oUiModel.getProperty("/stickyHeaderData/parent");
                                if (oCurrentParent) {
                                    oCurrentParent["m" + iYr + "_" + iIdx] = oInp.getValue();
                                    oUiModel.setProperty("/stickyHeaderData/parent", oCurrentParent);
                                }
                            }.bind(this)
                        }).addStyleClass("customYearInput sapUiSizeCompact");

                        return new sap.m.HBox({
                            renderType: "Bare",
                            justifyContent: "Center",
                            alignItems: "Center",
                            items: [oInput]
                        }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginEnd");
                    }.bind(this))(iRealIdx, sYear);
                }

                const sParentPath = "ui>/stickyHeaderData/parent/m" + sYear + "_" + iRealIdx;
                const sChildPath = "ui>/stickyHeaderData/child/m" + sYear + "_" + iRealIdx;

                const oTitleControl = (i === iStartIdx) ? new sap.m.HBox({
                    alignItems: "Center",
                    justifyContent: "Center",
                    renderType: "Bare",
                    width: "100%",
                    items: [
                        new sap.m.Label({ text: sMonthLabel + " " + sYear, design: "Bold", textAlign: "Center" }).addStyleClass("testBold titleGrande"),
                        new sap.m.Button({
                            type: "Transparent",
                            icon: "sap-icon://slim-arrow-right",
                            press: function (oEv) { this.onCreateMonthsTable(oEv); }.bind(this)
                        }).data("year", String(sYear)).addStyleClass("iconOnlyBtn lineHeightArrowIcon")
                    ]
                }).addStyleClass("monthHeaderHBox") : new sap.m.Label({
                    text: sMonthLabel + " " + sYear, design: "Bold", textAlign: "Center", width: "100%"
                }).addStyleClass("testBold titleGrande");

                const oColLabel = new sap.m.VBox({
                    width: "100%",
                    items: [
                        oTitleControl,
                        new sap.m.VBox({
                            renderType: "Bare", width: "100%", visible: "{ui>/showStickyParent}", height: "27px",
                            items: [new sap.m.Text({
                                text: { path: sParentPath, formatter: function (v) { return v || "\u00a0"; } },
                                wrapping: false, width: "100%", textAlign: "Center"
                            })]
                        }).addStyleClass("parentHeaderBox"),
                        new sap.m.VBox({
                            width: "100%", visible: "{ui>/showStickyChild}",
                            items: [new sap.m.Text({
                                text: { path: sChildPath, formatter: function (v) { return v || "\u00a0"; } },
                                wrapping: false, visible: "{ui>/showStickyChild}"
                            }).addStyleClass("secondStickyText")]
                        }).addStyleClass("parentHeader" + (i === iStartIdx ? " parentHeaderFirstMonth" : ""))
                    ]
                }).addStyleClass("fullWidthHeader");

                const oColumn = new sap.ui.table.Column({
                    width: "130px",
                    hAlign: "Center",
                    label: oColLabel,
                    template: oControlTemplate
                }).data("dynamicMonth", true);
                const bIsLastPassedMonth = bShowEjecutado && (
                    (sYear < currentYear && i === 11) ||
                    (sYear === currentYear && i === currentMonth - 1)
                );
                if (bIsLastPassedMonth) {
                    oColLabel.addStyleClass("borderRightLastMonth");
                    oControlTemplate.addStyleClass("borderRightLastMonth");
                }
                oTable.insertColumn(oColumn, colIndex + iOffset + (i - iStartIdx));
            }

            setTimeout(function () {
                try {
                    const oScrollExt = oTable._getScrollExtension();
                    if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                        oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                    }
                } catch (e) { }
                oTable.setBusy(false);
            }.bind(this), 50);
        },

/**
 * Se busca un control por su identificador tanto en la vista activa como en el
 * resto de elementos registrados en el nucleo de SAPUI5. Resulta necesario cuando
 * el control pertenece a una vista distinta de la vista hija en uso, como ocurre
 * con idEjecutadoCheckBox2 que reside en la Main view.
 */
_findControlGlobally: function (sId) {
    // Se comprueba primero si el control existe en la vista activa para evitar
    // una busqueda global innecesaria en el caso mas comun.
    var oLocal = this.byId(sId);
    if (oLocal) return oLocal;

    // Se recorren todos los elementos registrados en el nucleo de SAPUI5 buscando
    // aquel cuyo identificador coincida exactamente o termine con el sufijo indicado.
    var mElements = sap.ui.getCore().mElements || {};
    var aKeys = Object.keys(mElements);
    for (var i = 0; i < aKeys.length; i++) {
        var sKey = aKeys[i];
        if (sKey === sId || sKey.endsWith("--" + sId)) {
            return mElements[sKey];
        }
    }
    return null;
},

/**
 * Se ejecuta al interactuar con la casilla de verificacion de registros ejecutados.
 * Se marca la variante activa como modificada para habilitar el guardado directo
 * antes de delegar la logica de columnas al manejador interno correspondiente.
 */
onEjecutadoCheckBoxSelect: function (oEvent) {
    this._markVariantDirty();
    this._handleEjecutado(oEvent.getParameter("selected"));
},

        /**
         * Se procesa la visualización u ocultación de la columna de elementos ejecutados históricos.
         * Esta función reescribe la estructura de las columnas en función de si hay un nivel mensual abierto o no.
         */
        _handleEjecutado: function (bSelected) {
            // Se almacena el estado global de la selección para que futuras expansiones de años sepan si deben incluir históricos.
            this._bEjecutadoSelected = bSelected;

            // Se recupera la instancia de la TreeTable principal.
            const oTable = this.getControlTable();
            if (!oTable) return;

            // CASO 1: EL USUARIO DESMARCA LA CASILLA (OCULTAR EJECUTADOS)
            if (!bSelected) {
                // Se localizan todas las columnas que representan meses sueltos o columnas de históricos (ejecutados).
                oTable.getColumns()
                    .filter(function (c) { return c.data("dynamicMonth") || c.data("ejecutadosColumn"); })
                    // Se suprimen una a una de la tabla en el DOM.
                    .forEach(function (c) { oTable.removeColumn(c); });

                // Al ocultarse el desglose, se limpia la bandera del año abierto para reiniciar el estado de la vista.
                this._openedYear = null;
                return;
            }

            // CASO 2: EL USUARIO MARCA LA CASILLA (MOSTRAR EJECUTADOS) Y YA HABÍA UN AÑO DESPLEGADO EN MESES
            if (this._openedYear) {
                const sYear = this._openedYear;

                // Se eliminan los meses actuales de la pantalla. Esto se hace para forzar un repintado limpio que incluya la nueva columna de históricos mensuales.
                oTable.getColumns()
                    .filter(function (c) { return c.data("dynamicMonth"); })
                    .forEach(function (c) { oTable.removeColumn(c); });

                // Se busca la columna "padre" del año que estaba abierto (para saber dónde volver a insertar los meses).
                const oYearCol = oTable.getColumns().find(function (c) {
                    const lab = c.getLabel();
                    // Se extrae el texto de la cabecera teniendo en cuenta si es un Label simple o un VBox con items.
                    const txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                    return txt === String(sYear);
                });

                // Si se encontró la columna de ese año, se relanza la función creadora de meses simulando que el usuario hizo clic en ella.
                if (oYearCol) {
                    const sSubFijo = oYearCol.data("subFijoYear");
                    // Se fabrica un objeto evento simulado ("Mock Object") para engañar a 'onCreateMonthsTable' 
                    // haciéndole creer que fue disparado por un control estándar de SAPUI5.
                    this.onCreateMonthsTable({
                        getSource: function () {
                            return {
                                // Se simula la metadata de un Label para que el flujo interno de onCreateMonthsTable no falle.
                                getMetadata: function () {
                                    return { getName: function () { return "sap.m.Label"; } };
                                },
                                // Se proveen los datos requeridos por la función destino.
                                getText: function () { return String(sYear); },
                                data: function (sKey) {
                                    if (sKey === "subFijoYear") return sSubFijo;
                                    if (sKey === "year") return String(sYear);
                                    return null;
                                }
                            };
                        }
                    });
                }
            }
            // CASO 3: EL USUARIO MARCA LA CASILLA PERO LA TABLA ESTÁ EN VISTA ANUAL (NINGÚN MES EXPANDIDO)
            else {
                // Por precaución, se barren y eliminan columnas de ejecutados residuales.
                oTable.getColumns()
                    .filter(function (c) { return c.data("ejecutadosColumn"); })
                    .forEach(function (c) { oTable.removeColumn(c); });

                // Se busca la posición de la primera columna anual dinámica (ej: 2024).
                let iInsertIndex = oTable.getColumns().findIndex(function (c) {
                    return c.data("dynamicYear") === true;
                });

                // Si por alguna razón no se encuentran años, se colocará al final de la tabla.
                if (iInsertIndex === -1) iInsertIndex = oTable.getColumns().length;

                // Se inserta la columna consolidada (anual) de históricos en la posición calculada.
                oTable.insertColumn(this._buildEjecutadosColumn(false, new Date().getFullYear()), iInsertIndex);

                // Como regla de negocio en esta vista, al marcar "Ejecutados" se fuerza la apertura del primer año visible.
                const oPrimerAnioCol = oTable.getColumns().find(function (c) {
                    return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                });

                // Se repite la técnica del objeto evento simulado para forzar la expansión de ese primer año automáticamente.
                if (oPrimerAnioCol) {
                    const sSubFijoPrimero = oPrimerAnioCol.data("subFijoYear");
                    const sYearPrimero = oPrimerAnioCol.data("year");

                    this.onCreateMonthsTable({
                        getSource: function () {
                            return {
                                getMetadata: function () {
                                    return { getName: function () { return "sap.m.Button"; } };
                                },
                                getText: function () { return String(sYearPrimero); },
                                data: function (sKey) {
                                    if (sKey === "subFijoYear") return sSubFijoPrimero;
                                    if (sKey === "year") return String(sYearPrimero);
                                    return null;
                                }
                            };
                        }
                    });
                }
            }
        },

        /**
         * Se gestiona la lógica de las cabeceras pegajosas (sticky) durante el desplazamiento vertical de la tabla.
         */
        _onScrollLike: function (oEvent) {
            // Se evalúa si el sistema debe ignorar este evento de scroll por tratarse de un scroll programático de ajuste interno.
            if (this._ignoreNextScroll) {
                this._ignoreNextScroll = false;
                return;
            }

            const oTable = this.getControlTable();
            const oUiModel = this.getView().getModel("ui");

            // Si la tabla no tiene datos o rangos de grupos procesados, se aborta la lógica de cabeceras flotantes.
            if (!this._aGroupRanges || !this._aGroupRanges.length) {
                oUiModel.setProperty("/showStickyParent", false);
                this._setStickyChild(false);
                return;
            }

            // Se identifican los límites de la porción visible de la tabla en el DOM.
            const iFirstVisible = oEvent.getParameter("firstVisibleRow");
            const iVisibleCount = oTable.getVisibleRowCount();
            const iLastVisible = iFirstVisible + iVisibleCount - 1;

            let oActiveGroup = null;

            // Se recorren los rangos de índices caculados previamente para descubrir qué grupo jerárquico está dominando la parte superior de la tabla.
            for (let i = 0; i < this._aGroupRanges.length; i++) {
                const oGroup = this._aGroupRanges[i];
                // Si la primera fila visible está contenida dentro del inicio y fin de un grupo, ese es nuestro grupo activo.
                if (iFirstVisible >= oGroup.start && iFirstVisible <= oGroup.end) {
                    oActiveGroup = oGroup;
                    break;
                }
            }

            // Si el scroll está en un área sin agrupación definida, se ocultan todos los elementos flotantes.
            if (!oActiveGroup) {
                oUiModel.setProperty("/showStickyParent", false);
                oUiModel.setProperty("/showStickyChild", false);
                return;
            }

            // Se establecen los índices teóricos de dónde deberían estar el padre (agrupador) y su primer hijo en la jerarquía.
            const iParentRow = oActiveGroup.start;
            const iChildRow = oActiveGroup.start + 1;

            // Se evalúa si la fila original del padre o del hijo aún están pintándose en pantalla de manera natural.
            const bParentVisible = iParentRow >= iFirstVisible && iParentRow <= iLastVisible;
            const bChildVisible = iChildRow >= iFirstVisible && iChildRow <= iLastVisible;

            // Si el Padre Original se oculta por el scroll superior (!bParentVisible), se enciende la cabecera flotante simulada para reemplazarlo visualmente.
            oUiModel.setProperty("/showStickyParent", !bParentVisible);
            // La misma regla aplica para el hijo: solo se enciende su versión flotante si él y su padre ya desaparecieron del viewport superior.
            this._setStickyChild(!bChildVisible && !bParentVisible);

            // Se inyectan los datos reales del grupo activo en el modelo UI para que las cabeceras flotantes los muestren mediante Data Binding.
            oUiModel.setProperty("/stickyHeaderData", {
                parent: oActiveGroup.data,
                child: oActiveGroup.data.categories[0],
                path: oActiveGroup.path
            });

            // Se reevalúan los colores de la tabla ya que las cabeceras flotantes pueden alterar la percepción visual del diseño.
            this._applyCabeceraStyle();
        },

        /**
         * Se analiza el modelo de la tabla para definir los rangos de índices de cada grupo de datos.
         * Esto es vital para saber en qué momento encender o apagar las cabeceras flotantes durante el scroll.
         */
        _buildGroupRanges: function (sTableId) {
            const oTable = this.getControlTable();

            // Si la tabla no está lista, se vacía la matriz de rangos de forma preventiva.
            if (!oTable) {
                this._aGroupRanges = [];
                return;
            }

            // Se extrae la longitud total de las filas atadas a la tabla.
            const oBinding = oTable.getBinding("rows");
            const iLength = oBinding.getLength();
            const aRanges = [];
            let oCurrentGroup = null;

            // Se realiza un escaneo completo, fila por fila.
            for (let i = 0; i < iLength; i++) {
                const oCtx = oTable.getContextByIndex(i);
                if (!oCtx) continue;

                const oObj = oCtx.getObject();

                // Se determina el inicio de un nuevo grupo basándose en la existencia de un nodo con array de categorías (subelementos).
                if (oObj && oObj.categories && Array.isArray(oObj.categories)) {
                    // Si ya se estaba procesando un grupo, se cierra indicando que su rango finaliza justo antes de esta nueva fila.
                    if (oCurrentGroup) {
                        oCurrentGroup.end = i - 1;
                        aRanges.push(oCurrentGroup);
                    }
                    // Se inaugura un nuevo objeto de seguimiento de grupo con su índice de inicio.
                    oCurrentGroup = { name: oObj.name, start: i, end: i, data: oObj, path: oCtx.getPath() };
                }
            }

            // Al finalizar el bucle, se cierra el último grupo detectado otorgándole el final de la tabla como su límite.
            if (oCurrentGroup) {
                oCurrentGroup.end = iLength - 1;
                aRanges.push(oCurrentGroup);
            }

            // Se consolidan los rangos analizados en la variable de la clase.
            this._aGroupRanges = aRanges;
        },

        /**
         * Se calcula dinámicamente la cantidad de filas que caben en pantalla según el tamaño de la ventana.
         * Esto evita que la tabla muestre scroll interno innecesario o deje espacios vacíos masivos al final de la vista.
         */
        _calculateDynamicRows: function () {
            const oTable = this.getControlTable();
            // Se valida que la tabla ya tenga una existencia física en el DOM del navegador.
            if (!oTable || !oTable.getDomRef()) {
                return;
            }

            // Se obtiene la altura total de la ventana gráfica actual del navegador.
            const iWindowHeight = window.innerHeight;
            // Se calculan las coordenadas exactas de dónde comienza a pintarse la tabla en la pantalla.
            const oTableRect = oTable.getDomRef().getBoundingClientRect();
            const iTableTop = oTableRect.top;

            // Se establece un margen duro para reservar espacio para el pie de página, scrollbars y paddings generales del layout.
            const iBottomSpace = 148;
            // Se deduce el espacio vertical neto que realmente le queda a la tabla para expandirse.
            const iAvailableHeight = iWindowHeight - iTableTop - iBottomSpace;
            // Se asume la altura fija de cada fila según las guías de diseño "Compact" de Fiori.
            const iRowHeight = 32;

            // Se divide la altura disponible entre la altura por fila para calcular cuántas filas exactas caben sin desbordar.
            let iRows = Math.floor(iAvailableHeight / iRowHeight);

            // Se implementa una red de seguridad: independientemente de lo pequeña que sea la ventana, siempre se renderizarán al menos 5 filas para mantener la usabilidad.
            if (iRows < 5) {
                iRows = 5;
            }

            // Se publica el dato en el modelo reactivo de la vista para que el control de la tabla modifique su "visibleRowCount" automáticamente.
            this.getView().getModel("viewModel").setProperty("/dynamicRowCount", iRows);
        },

        /**
          * Se filtran las categorías recursivamente según una clave específica.
          * Esta función permite buscar un nodo en el árbol y mantener toda su ascendencia y descendencia visible.
          */
        _filterCategories: function (aCategories, sKey) {
            // Se valida que la entrada sea un arreglo válido; de lo contrario, se retorna un arreglo vacío para evitar errores de iteración.
            if (!Array.isArray(aCategories)) return [];

            // Se itera sobre todas las categorías del nivel actual.
            return aCategories.map(function (cat) {
                // Se genera un clon superficial del nodo actual para no mutar el modelo original de datos.
                const oClone = Object.assign({}, cat);
                // Se realiza una llamada recursiva para buscar coincidencias en los niveles inferiores (hijos).
                const aFilteredChildren = this._filterCategories(cat.categories || [], sKey);

                // Se evalúa la coincidencia directa: si el nombre de la categoría actual coincide con la clave buscada.
                if (cat.name === sKey) {
                    // Se conservan todos sus hijos originales, ya que el nodo completo debe mostrarse.
                    oClone.categories = cat.categories || [];
                    return oClone;
                }

                // Se evalúa la coincidencia indirecta: si la categoría actual no coincide, pero tiene hijos que sí lo hacen.
                if (aFilteredChildren.length > 0) {
                    // Se reemplaza la lista de hijos con únicamente aquellos que cumplieron el criterio de búsqueda.
                    oClone.categories = aFilteredChildren;
                    return oClone;
                }

                // Si ni el nodo ni sus hijos coinciden, se retorna nulo para descartarlo.
                return null;
            }.bind(this)).filter(Boolean); // Se filtran y eliminan todos los valores nulos resultantes del map.
        },

        /**
         * Se colapsa un grupo desde la cabecera sticky, actualizando la vista de la tabla.
         * Permite al usuario cerrar un agrupador haciendo clic en la cabecera flotante.
         */
        onCollapseFromHeader: function () {
            const oTable = this.getControlTable();
            const oUiModel = this.getView().getModel("ui");
            // Se recupera la ruta del modelo (path) correspondiente al grupo que está actualmente anclado en la cabecera sticky.
            const sTargetPath = oUiModel.getProperty("/stickyHeaderData/path");

            // Si no hay una ruta válida fijada, se interrumpe la ejecución.
            if (!sTargetPath) {
                return;
            }

            const oBinding = oTable.getBinding("rows");
            const iLength = oBinding.getLength();
            let iCollapsedIndex = null;

            // Se busca la fila exacta dentro de la tabla que corresponde a la ruta del grupo.
            for (let i = 0; i < iLength; i++) {
                const oCtx = oTable.getContextByIndex(i);
                if (oCtx && oCtx.getPath() === sTargetPath) {
                    // Si el grupo está expandido, se procede a colapsarlo.
                    if (oTable.isExpanded(i)) {
                        oTable.collapse(i);
                        iCollapsedIndex = i; // Se guarda el índice para validaciones posteriores.
                    }
                    break;
                }
            }

            // Si no se colapsó nada (por ejemplo, ya estaba cerrado o no se encontró), se aborta.
            if (iCollapsedIndex === null) {
                return;
            }

            // Se utiliza setTimeout para permitir que el motor de renderizado de SAPUI5 procese el colapso antes de recalcular la interfaz.
            setTimeout(function () {
                // Se reconstruyen los rangos de los grupos jerárquicos ya que la topología de la tabla ha cambiado.
                this._buildGroupRanges();
                const iFirstVisible = oTable.getFirstVisibleRow();

                // Se fuerza la actualización de la lógica de cabeceras flotantes (sticky headers) simulando un evento de scroll en la posición actual.
                this._onScrollLike({
                    getParameter: function (sName) {
                        if (sName === "firstVisibleRow") {
                            return iFirstVisible;
                        }
                    }
                });

                let bAnyDetailExpanded = false;
                const oUpdatedBinding = oTable.getBinding("rows");

                // Se verifica si, tras colapsar el nodo, queda algún otro nivel de detalle expandido en toda la tabla.
                if (oUpdatedBinding) {
                    const iUpdatedLength = oUpdatedBinding.getLength();
                    for (let i = 0; i < iUpdatedLength; i++) {
                        if (oTable.isExpanded(i)) {
                            const oCtx = oTable.getContextByIndex(i);
                            const oObj = oCtx && oCtx.getObject();

                            // Si se encuentra al menos un agrupador de detalle abierto, se activa la bandera y se detiene la búsqueda.
                            if (oObj && oObj.categories && oObj.categories[0] && oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                                break;
                            }
                        }
                    }
                }

                // Se obtienen las referencias a las columnas dinámicas.
                const oColMonths = this.byId("colMonths");
                const oColNew = this.byId("colNew");
                const oColCheck1 = this.byId("colCheckBox1");
                const oColCheck2 = this.byId("colCheckBox2");

                // Se ajusta la visibilidad de las columnas accesorias en función de si hay detalles expandidos.
                if (oColMonths) oColMonths.setVisible(bAnyDetailExpanded);
                if (oColNew) oColNew.setVisible(bAnyDetailExpanded);
                if (oColCheck1) oColCheck1.setVisible(bAnyDetailExpanded);
                if (oColCheck2) oColCheck2.setVisible(bAnyDetailExpanded);

                // Si no queda absolutamente nada expandido, se limpia por completo el estado de las cabeceras sticky y los grupos.
                if (!bAnyDetailExpanded) {
                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    this._setStickyChild(false);
                }

                // Si ambas cabeceras sticky (padre e hijo) están ocultas, se purgan sus datos del modelo visual para evitar renderizados fantasmas.
                if (!oUiModel.getProperty("/showStickyParent") && !oUiModel.getProperty("/showStickyChild")) {
                    oUiModel.setProperty("/stickyHeaderData", null);
                }
            }.bind(this), 0);
        },

        /**
         * Se obtiene el ID personalizado de la tabla. 
         * Es una función abstracta por defecto que retorna vacío, diseñada para ser sobrescrita por los controladores hijos.
         */
        getCustomTableId: function () {
            return "";
        },

        /**
         * Se retorna la tabla dinámica de la vista actual. 
         * Si el controlador hijo define un ID específico mediante getCustomTableId, se utiliza ese ID para localizar la tabla.
         */
        getControlTable: function () {
            const sId = this.getCustomTableId();
            return this.byId(sId);
        },

        /**
         * Se configuran las propiedades y eventos necesarios para el funcionamiento de una TreeTable dinámica.
         * Centraliza la asignación de delegados de teclado, cálculos de tamaño y eventos de scroll.
         */
        setupDynamicTreeTable: function (sTableId) {
            // Se localiza la tabla ya sea por el ID proporcionado o mediante el método de obtención predeterminado.
            const oTable = sTableId ? this.byId(sTableId) : this.getControlTable();
            if (!oTable) {
                return; // Se aborta si la tabla no existe en la vista.
            }

            // Se adjunta el evento que detecta cuando el usuario hace scroll vertical.
            oTable.attachFirstVisibleRowChanged(function (oEvent) {
                // Se procesa la lógica de las cabeceras pegajosas.
                this._onScrollLike(oEvent);
                // Se vuelven a asignar los delegados del teclado a los nuevos inputs que han entrado en el área visible tras el scroll.
                this._attachArrowDelegates(oTable);
            }.bind(this));

            // Se define un arreglo con los IDs de las columnas accesorias (meses, checkboxes) y se ocultan por defecto en la carga inicial.
            const aColsToHide = ["colMonths", "colNew", "colCheckBox1", "colCheckBox2"];
            aColsToHide.forEach(colId => {
                if (this.byId(colId)) this.byId(colId).setVisible(false);
            });

            // Se inicializa el delegado general de eventos de teclado si no existía previamente.
            if (!this._arrowDelegate) {
                this._arrowDelegate = {
                    onkeydown: function (oEvent) {
                        this._onInputKeyDown(oEvent);
                    }.bind(this)
                };
            }

            // Se asignan los delegados visuales (colores y teclado) justo después de que la tabla se renderiza por primera vez.
            oTable.addEventDelegate({
                onAfterRendering: function () {
                    this._attachArrowDelegates(oTable);
                    this._applyCabeceraStyle(oTable);
                }.bind(this)
            });

            // Se asegura que cada vez que los datos de las filas cambian (ej. por un expandir/contraer), se repongan los delegados de teclado.
            // Se utiliza una bandera booleana para evitar asociar el mismo evento múltiples veces.
            if (!oTable._rowsDelegateAttached) {
                oTable.attachEvent("rowsUpdated", function () {
                    this._attachArrowDelegates(oTable);
                }.bind(this));
                oTable._rowsDelegateAttached = true;
            }

            // Se garantiza la existencia de un modelo de interfaz ('viewModel') para gestionar la cantidad de filas visibles.
            if (!this.getView().getModel("viewModel")) {
                const oViewModel = new sap.ui.model.json.JSONModel({
                    dynamicRowCount: 10
                });
                this.getView().setModel(oViewModel, "viewModel");
            }

            // Se ejecuta la lógica de cálculo matemático para adaptar la tabla al tamaño actual de la ventana.
            this._calculateDynamicRows();

            // Se controla el borrado de los filtros nativos de la tabla.
            if (!oTable._filterEmptyAttached) {
                oTable.attachEvent("filter", function (oEvent) {
                    // Si el usuario borra el texto de un filtro (value vacío), se previene el comportamiento nativo y se invoca la lógica manual de restauración.
                    if (!oEvent.getParameter("value")) {
                        oEvent.preventDefault();
                        this.onTreeTableFilter(oEvent);
                    }
                }.bind(this));
                oTable._filterEmptyAttached = true;
            }
        },

        /**
         * Se asignan los delegados de las flechas del teclado a todos los campos de entrada visibles.
         * Permite la navegación tipo "Excel" entre las celdas de la tabla.
         */
        _attachArrowDelegates: function (oTable) {
            // Se valida o crea el objeto delegado para interceptar la pulsación de teclas.
            if (!this._arrowDelegate) {
                this._arrowDelegate = {
                    onkeydown: function (oEvent) {
                        this._onInputKeyDown(oEvent);
                    }.bind(this)
                };
            }

            // Se obtienen únicamente las filas que están dibujadas en el DOM en este instante.
            const aRows = oTable.getRows();

            // Se itera sobre cada fila y, seguidamente, sobre cada celda que compone la fila.
            aRows.forEach(function (oRow) {
                oRow.getCells().forEach(function (oCell) {
                    // Se utiliza una función recursiva para buscar dentro de la celda si existe un control Input oculto bajo otros layouts (VBox, HBox).
                    const oInput = this._recursiveGetInput(oCell);

                    if (oInput) {
                        // Se elimina el delegado antes de añadirlo para garantizar que no se acumulen disparadores múltiples del mismo evento.
                        oInput.removeEventDelegate(this._arrowDelegate);
                        oInput.addEventDelegate(this._arrowDelegate);
                    }
                }.bind(this));
            }.bind(this));
        },

        /**
         * Se maneja la navegación direccional con las teclas de flecha entre los campos de entrada de la tabla.
         */
   _onInputKeyDown: function (oEvent) {
    const oInput = oEvent.srcControl;
    const iKeyCode = oEvent.keyCode;

    // Se definen constantes booleanas para identificar claramente qué flecha fue presionada.
    const bDown = iKeyCode === 40;
    const bUp = iKeyCode === 38;
    const bRight = iKeyCode === 39;
    const bLeft = iKeyCode === 37;

    // Si la tecla pulsada no es una flecha de navegación, se ignora el evento y se permite el comportamiento por defecto.
    if (!bDown && !bUp && !bRight && !bLeft) return;

    // Se recupera la referencia del DOM (HTML nativo) del Input para leer su valor exacto antes de que el framework lo procese.
    const oDomRef = oInput.getFocusDomRef();
    if (!oDomRef) return;

    // Si se navega horizontalmente, se previene el salto nativo del cursor de texto para que podamos cambiar de celda en su lugar.
    if (bLeft || bRight) oEvent.preventDefault();

    // Se sincroniza el valor del DOM con el control SAPUI5 para evitar la pérdida de datos introducidos parcialmente antes de cambiar de celda.
    const sCurrentDomValue = oDomRef.value;
    oInput.setValue(sCurrentDomValue);
    if (oInput.updateModelProperty) oInput.updateModelProperty(sCurrentDomValue);

    // Se detiene la propagación del evento para que no interfiera con otras funcionalidades nativas del navegador.
    oEvent.preventDefault();
    oEvent.stopImmediatePropagation();

    const oTable = this.getControlTable();
    if (!oTable) return;

    const oBinding = oTable.getBinding("rows");
    if (!oBinding) return;

    // Se navega hacia arriba en la jerarquía de controles de UI5 buscando el padre que sea estrictamente una fila.
    let oParent = oInput.getParent();
    while (oParent && !oParent.isA("sap.ui.table.Row")) {
        oParent = oParent.getParent();
    }

    // Si no se logra ubicar la fila, se cancela la operación.
    if (!oParent) return;

    // Se obtiene el índice actual de la fila y el contexto de datos vinculado a ella mediante el modelo nombrado.
    const iCurrentRowIndex = oParent.getIndex();
    const oCurrentContext = oParent.getBindingContext("corrientesModel");
    if (!oCurrentContext) return;

    // Se recorren las celdas de la fila actual para averiguar en qué índice de columna se encuentra el Input enfocado.
    const aCells = oParent.getCells();
    let iTargetColIndex = -1;
    for (let i = 0; i < aCells.length; i++) {
        // Se utiliza una búsqueda recursiva para confirmar si la celda iterada contiene el Input enfocado.
        if (this._cellContainsInput(aCells[i], oInput)) {
            iTargetColIndex = i;
            break;
        }
    }
    if (iTargetColIndex === -1) return;

    // ── LÓGICA DE NAVEGACIÓN HORIZONTAL (DERECHA / IZQUIERDA) ─────────────────────────────
    if (bLeft || bRight) {
        // Se traduce el índice absoluto de fila a índice relativo a la vista actual para acceder al elemento renderizado.
        const iFirstVisible = oTable.getFirstVisibleRow();
        const iVisibleRowIndex = iCurrentRowIndex - iFirstVisible;

        // Se valida que la fila calculada sea visible en el viewport actual.
        if (iVisibleRowIndex < 0 || iVisibleRowIndex >= oTable.getRows().length) {
            setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
            return;
        }

        const oRow = oTable.getRows()[iVisibleRowIndex];
        if (!oRow) {
            setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
            return;
        }

        // Se inicializa el índice de búsqueda horizontal y la referencia al input destino.
        let iNewColIndex = iTargetColIndex;
        let oTargetInput = null;
        const iTotalCols = oTable.getColumns().length;

        // Se itera en la dirección indicada saltando celdas sin input o con inputs no editables.
        while (true) {
            iNewColIndex = bRight ? iNewColIndex + 1 : iNewColIndex - 1;

            // Si se alcanza el límite lateral de la tabla, se mantiene el foco en el input actual.
            if (iNewColIndex < 0 || iNewColIndex >= iTotalCols) {
                setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                return;
            }

            const oCell = oRow.getCells()[iNewColIndex];
            if (!oCell) continue;

            // Se busca cualquier input visible en la celda ignorando la restricción de editable para detectar su existencia.
            const oCandidato = this._recursiveGetInput(oCell, true);
            if (!oCandidato) continue; // La celda no contiene ningún input, se continúa la búsqueda.

            // Si el input existe y es editable, se establece como destino y se detiene la búsqueda.
            if (oCandidato.getEditable()) {
                oTargetInput = oCandidato;
                break;
            }
            // Si el input existe pero no es editable, se salta y se continúa en la misma dirección.
        }

        // Se transfiere el foco al input destino encontrado o se devuelve al original si no se halló ninguno.
        if (oTargetInput) {
            setTimeout(function () {
                oTargetInput.focus();
                if (oTargetInput.select) oTargetInput.select();
            }, 10);
        } else {
            setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
        }
        return;
    }

    // ── LÓGICA DE NAVEGACIÓN VERTICAL (ARRIBA / ABAJO) ────────────────────────────────────
    let iTargetRowIndex = null;
    let sTargetPath = null;
    let iSearchIndex = iCurrentRowIndex;
    let iSearchSteps = 0;

    // Se busca de forma iterativa la próxima fila válida saltando nodos padre y celdas no editables.
    while (true) {
        // Se incrementa o decrementa el índice lógico en base a la dirección de la flecha.
        iSearchIndex = bDown ? iSearchIndex + 1 : iSearchIndex - 1;
        iSearchSteps++;

        // Si se alcanza el límite superior o inferior absoluto de la tabla, se cancela el movimiento.
        if (iSearchIndex < 0 || iSearchIndex >= oBinding.getLength()) {
            setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
            return;
        }

        // Se evita un posible bucle infinito limitando la búsqueda a doscientas iteraciones.
        if (iSearchSteps > 200) {
            setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
            return;
        }

        // Se extrae el contexto de la nueva fila candidata.
        const oCtx = oTable.getContextByIndex(iSearchIndex);
        if (!oCtx) continue;

        const oData = oCtx.getObject();
        if (!oData) continue;

        // Se descartan los nodos raíz marcados como padre ya que no contienen inputs editables.
        if (oData.padre === true) continue;

        // Se verifica si la fila candidata es visible en el viewport actual para poder inspeccionar su input.
        const iFirstVisCheck = oTable.getFirstVisibleRow();
        const iVisIdxCheck = iSearchIndex - iFirstVisCheck;

        if (iVisIdxCheck >= 0 && iVisIdxCheck < oTable.getRows().length) {
            // La fila es visible en pantalla, se inspecciona directamente si su celda contiene un input editable.
            const oRowCheck = oTable.getRows()[iVisIdxCheck];
            if (oRowCheck) {
                const oCellCheck = oRowCheck.getCells()[iTargetColIndex];
                // Se busca cualquier input visible ignorando editable para detectar su existencia.
                const oInputCheck = this._recursiveGetInput(oCellCheck, true);
                // Si no hay input o no es editable, se salta esta fila y se continúa la búsqueda.
                if (!oInputCheck || !oInputCheck.getEditable()) continue;
            }
        }
        // Si la fila no es visible aún porque requiere scroll, se acepta directamente como destino
        // ya que no es posible inspeccionar inputs de filas no renderizadas en el DOM.

        // Se fija el índice y la ruta de la fila destino y se detiene la búsqueda.
        iTargetRowIndex = iSearchIndex;
        sTargetPath = oCtx.getPath();
        break;
    }

    // ── LÓGICA DE SCROLL AUTOMÁTICO ───────────────────────────────────────────────────────
    const iFirstVisible = oTable.getFirstVisibleRow();
    const iVisibleCount = oTable.getVisibleRowCount();
    const iLastVisible = iFirstVisible + iVisibleCount - 1;

    let bNeedsScroll = false;
    let iNewFirstVisible = iFirstVisible;

    // Se determina si la fila de destino se encuentra por debajo de la zona visible.
    if (iTargetRowIndex > iLastVisible) {
        // Se ajusta la posición de inicio para que la fila objetivo aparezca al final de la pantalla.
        iNewFirstVisible = iTargetRowIndex - iVisibleCount + 1;
        bNeedsScroll = true;
    }
    // Se determina si la fila de destino se encuentra por encima de la zona visible.
    else if (iTargetRowIndex < iFirstVisible) {
        // Se ajusta la posición de inicio para que la fila objetivo aparezca en la parte superior.
        iNewFirstVisible = iTargetRowIndex;
        bNeedsScroll = true;
    }

    // ── ASIGNACIÓN DE FOCO CON SCROLL ─────────────────────────────────────────────────────
    if (bNeedsScroll) {
        const that = this;
        let bFocused = false;

        // Se define una función de cierre que ejecutará el enfoque una vez que la tabla termine de desplazarse.
        const fnFocus = function () {
            // Se utiliza una bandera para evitar que el evento rowsUpdated dispare el enfoque múltiples veces.
            if (bFocused) return;
            bFocused = true;

            const aRows = oTable.getRows();
            let oTargetRow = null;

            // Se escanean las filas recién dibujadas buscando aquella cuyo contexto coincida con la ruta de destino.
            for (let i = 0; i < aRows.length; i++) {
                const oRowContext = aRows[i].getBindingContext("corrientesModel");
                if (oRowContext && oRowContext.getPath() === sTargetPath) {
                    oTargetRow = aRows[i];
                    break;
                }
            }

            // Si no se encuentra la fila tras el scroll, se devuelve el foco a la posición inicial como salvaguarda.
            if (!oTargetRow) {
                oInput.focus();
                if (oInput.select) oInput.select();
                return;
            }

            // Se ubica el input dentro de la celda pertinente y se le transfiere el foco.
            const oCell = oTargetRow.getCells()[iTargetColIndex];
            const oTargetInput = that._recursiveGetInput(oCell);

            if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                oTargetInput.focus();
                if (oTargetInput.select) oTargetInput.select();
            } else {
                oInput.focus();
                if (oInput.select) oInput.select();
            }
        };

        // Se ata el evento para ejecutar el enfoque en el momento en que la tabla comunica que terminó de renderizar el desplazamiento.
        oTable.attachEventOnce("rowsUpdated", function () {
            setTimeout(fnFocus, 50);
        });

        // Se instruye físicamente a la tabla para que se mueva a la nueva fila inicial calculada.
        oTable.setFirstVisibleRow(iNewFirstVisible);

        // Se establece un temporizador de respaldo en caso de que el evento rowsUpdated falle o se pierda.
        setTimeout(fnFocus, 300);

    } else {
        // ── ASIGNACIÓN DE FOCO SIN SCROLL ─────────────────────────────────────────────────
        // Se capturan las variables necesarias en el ámbito del closure para evitar pérdidas de referencia.
        const sPath = sTargetPath;
        const iColIdx = iTargetColIndex;

        setTimeout(function () {
            const aRows = oTable.getRows();
            let oTargetRow = null;

            // Se busca la fila objetivo por su ruta de binding utilizando el nombre del modelo correcto.
            for (let i = 0; i < aRows.length; i++) {
                const oRowContext = aRows[i].getBindingContext("corrientesModel");
                if (oRowContext && oRowContext.getPath() === sPath) {
                    oTargetRow = aRows[i];
                    break;
                }
            }

            // Se devuelve el foco al input original si no se localiza la fila destino.
            if (!oTargetRow) {
                oInput.focus();
                if (oInput.select) oInput.select();
                return;
            }

            // Se extrae el input de la celda destino y se le transfiere el foco.
            const oCell = oTargetRow.getCells()[iColIdx];
            const oTargetInput = this._recursiveGetInput(oCell);

            if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                oTargetInput.focus();
                if (oTargetInput.select) oTargetInput.select();
            } else {
                oInput.focus();
                if (oInput.select) oInput.select();
            }
        }.bind(this), 10);
    }
},

        /**
         * Se verifica recursivamente si un contenedor (celda u otro layout) contiene un determinado campo de entrada.
         * Es necesario porque las celdas de las columnas no suelen contener el Input de forma directa, sino envuelto en contenedores como HBox o VBox.
         */
        _cellContainsInput: function (oCell, oTargetInput) {
            // Caso base: el elemento analizado es directamente el input buscado.
            if (oCell === oTargetInput) return true;

            // Se revisa si el control posee agregaciones del tipo "items" (típico de flexboxes de SAPUI5).
            if (oCell.getItems) {
                const aItems = oCell.getItems();
                for (let i = 0; i < aItems.length; i++) {
                    // Se comprueba el ítem directo y, si no es, se profundiza recursivamente.
                    if (aItems[i] === oTargetInput) return true;
                    if (this._cellContainsInput(aItems[i], oTargetInput)) return true;
                }
            }

            // Se revisa si el control posee agregaciones del tipo "content" (típico de paneles o layouts antiguos).
            if (oCell.getContent) {
                const aContent = oCell.getContent();
                for (let j = 0; j < aContent.length; j++) {
                    if (aContent[j] === oTargetInput) return true;
                    if (this._cellContainsInput(aContent[j], oTargetInput)) return true;
                }
            }

            // Si se agotan las ramas y no se encuentra el Input, se devuelve falso.
            return false;
        },

        /**
                 * Se busca de forma recursiva un control Input editable dentro de una celda.
                 * Esta función es crucial porque las celdas de las tablas suelen envolver sus elementos en layouts contenedores (VBox, HBox).
                 */
        _recursiveGetInput: function (oControl) {
            // Se valida que el control exista antes de intentar procesarlo.
            if (!oControl) return null;

            // Caso base: se verifica si el control evaluado es directamente la instancia de entrada buscada.
            if (oControl.isA && oControl.isA("sap.m.Input")) {
                // Se garantiza que el input solo se retorne si está habilitado para la interacción del usuario.
                if (oControl.getVisible() && oControl.getEditable()) {
                    return oControl;
                }
            }

            // Si el control es un contenedor de diseño tradicional (ej. Panel, Page), se escanean sus elementos hijos.
            if (oControl.getContent) {
                const aContent = oControl.getContent();
                for (let i = 0; i < aContent.length; i++) {
                    // Se profundiza en el árbol de la interfaz mediante una llamada recursiva.
                    const res = this._recursiveGetInput(aContent[i]);
                    // Si se halla un input válido en esta rama, se detiene la búsqueda y se propaga hacia arriba.
                    if (res) return res;
                }
            }

            // Si el control es un contenedor de agregación flexible (ej. VBox, HBox, FlexBox), se inspeccionan sus ítems.
            if (oControl.getItems) {
                const aItems = oControl.getItems();
                for (let j = 0; j < aItems.length; j++) {
                    const resIt = this._recursiveGetInput(aItems[j]);
                    if (resIt) return resIt;
                }
            }

            // Si tras explorar todas las ramas no se detecta ningún Input, se retorna un valor nulo.
            return null;
        },

        /**
         * Se construye una lista desplegable de operaciones a partir de las categorías expandibles.
         * Se extraen los datos de la jerarquía compleja para aplanarlos en una lista simple para el selector superior.
         */
        _buildOperacionesCombo: function (aCategories) {
            const aResult = [];

            // Se define una función recursiva interna para navegar por todos los niveles del árbol de datos.
            function recurse(aNodes) {
                // Si la rama no es un arreglo válido, se interrumpe la ejecución para ese nodo.
                if (!Array.isArray(aNodes)) return;

                // Se procesa cada elemento individual del nivel actual.
                aNodes.forEach(function (oNode) {
                    // Se verifica si el nodo está marcado como expandible o si posee hijos reales, lo que lo califica como una "operación" seleccionable.
                    if (oNode.expandible || (Array.isArray(oNode.categories) && oNode.categories.length > 0)) {
                        aResult.push({
                            key: oNode.name,
                            text: oNode.name + " - " + (oNode.currency || "")
                        });
                    }
                    // Si el nodo contiene subdivisiones, se llama a la función de manera recursiva para seguir extrayendo datos.
                    if (Array.isArray(oNode.categories)) {
                        recurse(oNode.categories);
                    }
                });
            }

            // Se inicia el proceso de extracción desde la raíz proporcionada.
            recurse(aCategories);
            return aResult;
        },

        /**
          * Se filtra la TreeTable según la operación seleccionada en el menú desplegable.
          * Este evento aísla un nodo específico (y su línea ascendente/descendente) ocultando el resto de la tabla.
          */
        onOperacionChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oTable = this.getControlTable();
            const oDefaultModel = this.getView().getModel();
            const oUiModel = this.getView().getModel("ui");

            // Se genera una copia de seguridad inicial por única vez para tener el estado completo del árbol antes del filtro.
            if (!this._fullCategoriesBackup) {
                const aOriginal = oDefaultModel.getProperty("/catalog/models/categories");
                this._fullCategoriesBackup = JSON.parse(JSON.stringify(aOriginal));
            }

            // CASO: EL USUARIO LIMPIA EL SELECTOR (NO HAY SELECCIÓN)
            // Se debe restaurar la tabla completa sin perder los datos que el usuario haya podido teclear mientras estaba filtrada.
            if (!oSelectedItem) {
                const aCurrent = oDefaultModel.getProperty("/catalog/models/categories");
                // Se fusionan los datos actuales de la vista reducida con el respaldo original para preservar la edición.
                const aRestored = this._mergeModifications(
                    JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                    aCurrent
                );

                // Se reinyecta el árbol completo al modelo.
                oDefaultModel.setProperty("/catalog/models/categories", aRestored);

                // Se reinicia la visibilidad estandarizada de las columnas accesorias (ocultas por defecto).
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
                if (this.byId("colNew")) this.byId("colNew").setVisible(false);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(false);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(false);

                // Se desactivan las cabeceras pegajosas (sticky) para limpiar la UI.
                if (oUiModel) oUiModel.setProperty("/showStickyParent", false);
                this._setStickyChild(false);

                // Se utiliza setTimeout para asegurar que la tabla colapse todos los nodos después de que el modelo haya sido renderizado.
                setTimeout(function () {
                    oTable.collapseAll();
                    this._refreshAfterToggle(oTable.getId());
                }.bind(this), 0);
                return;
            }

            // CASO: EL USUARIO SELECCIONA UNA OPERACIÓN ESPECÍFICA
            // Se captura la clave primaria del ítem elegido en el desplegable.
            const sKey = oSelectedItem.getKey();

            // Se cuentan los puntos en la nomenclatura para inferir la jerarquía (ej. I.003 es padre, I.003.031 es hijo).
            const iDotCount = (sKey.match(/\./g) || []).length;
            let sParentKey = null;

            // Si tiene múltiples puntos, se deduce la clave de su padre directo quitando la última sección.
            if (iDotCount >= 2) {
                sParentKey = sKey.substring(0, sKey.lastIndexOf("."));
            }

            // Se obtiene el estado actual y se fusiona con la copia completa para no perder ediciones no guardadas antes del filtro.
            const aCurrentList = oDefaultModel.getProperty("/catalog/models/categories");
            const aWorkingCopy = this._mergeModifications(
                JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                aCurrentList
            );
            const aFilteredRoot = [];

            // Se itera sobre el nivel más alto del árbol consolidado para aplicar las reglas de aislamiento.
            for (let i = 0; i < aWorkingCopy.length; i++) {
                const rootCat = aWorkingCopy[i];
                if (!Array.isArray(rootCat.categories)) {
                    rootCat.categories = [];
                }

                // Sub-Caso 1: El elemento seleccionado es un padre principal directamente anclado a la raíz.
                if (rootCat.name === sKey && !sParentKey) {
                    aFilteredRoot.push(rootCat);
                    continue;
                }

                // Sub-Caso 2: El elemento seleccionado es un nivel profundo (hijo).
                if (sParentKey) {
                    // Se emplea la función auxiliar recursiva para buscar la coincidencia de clave en las ramas.
                    let aFilteredChildren = this._filterCategories(rootCat.categories, sKey);
                    const bIncludeParent = rootCat.name === sParentKey;

                    // Si esta rama en particular no tiene el hijo y no es el padre que lo contiene, se salta (se oculta de la tabla final).
                    if (aFilteredChildren.length === 0 && !bIncludeParent) {
                        continue;
                    }

                    // Si se encontraron hijos válidos, se poda el árbol asignándole únicamente esta descendencia filtrada.
                    if (aFilteredChildren.length > 0) {
                        rootCat.categories = aFilteredChildren;
                    }
                    // Alternativamente, si estamos procesando al padre contenedor, forzamos su filtrado para aligerar la vista.
                    else if (bIncludeParent) {
                        rootCat.categories = this._filterCategories(rootCat.categories, sKey);
                    }

                    aFilteredRoot.push(rootCat);
                }
            }

            // Se aplica el arreglo de nodos ya depurado y filtrado al modelo visual de la tabla.
            oDefaultModel.setProperty("/catalog/models/categories", aFilteredRoot);

            // Se delega a un ciclo asíncrono (setTimeout) la expansión automática de los nodos filtrados.
            setTimeout(function () {
                const oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                let bAnyDetailExpanded = false;

                // Se colapsa toda la estructura antes de procesar las aperturas calculadas.
                oTable.collapseAll();

                // Se recorren las filas físicas de la tabla que acaba de ser dibujada.
                for (let i = 0; i < oBinding.getLength(); i++) {
                    const oCtx = oTable.getContextByIndex(i);
                    const oObj = oCtx && oCtx.getObject();

                    if (!oObj) continue;

                    // Se evalúa si la fila debe expandirse forzosamente debido al criterio de búsqueda.
                    if (sParentKey) {
                        // Si la fila representa al padre contenedor o al objetivo directo, y permite apertura, se expande.
                        if ((oObj.name === sParentKey || oObj.name === sKey) && oObj.expandible) {
                            oTable.expand(i);

                            // Se verifica si al expandir se han revelado nodos terminales de detalle profundo.
                            if (oObj.name === sKey && Array.isArray(oObj.categories) &&
                                oObj.categories.length > 0 && oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    } else if (sKey) {
                        // Si no había padre, simplemente se evalúa la coincidencia contra la clave primaria general.
                        if (oObj.name === sKey && oObj.expandible === true) {
                            oTable.expand(i);
                            if (Array.isArray(oObj.categories) && oObj.categories.length > 0 &&
                                oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    }
                }

                // Se activan las columnas detalladas (meses, checkboxes) únicamente si la expansión resultó en la muestra de niveles inferiores.
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(bAnyDetailExpanded);
                if (this.byId("colNew")) this.byId("colNew").setVisible(bAnyDetailExpanded);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(bAnyDetailExpanded);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(bAnyDetailExpanded);

                // Se blanquea la UI para evitar superposiciones residuales de elementos sticky de la vista anterior.
                if (oUiModel) {
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }

                // Se repasan los estilos de cabecera y el scroll después de alterar drásticamente la tabla.
                this._refreshAfterToggle(oTable.getId());
            }.bind(this), 100);
        },

        /**
         * Se combinan las modificaciones del usuario (tecleadas en la tabla actual) con la estructura base o backup.
         * Evita que se pierdan datos ingresados cuando se aplican o quitan filtros destructivos.
         */
        _mergeModifications: function (aBase, aModified) {
            // Si no hay datos modificados para combinar, se devuelve la base intacta.
            if (!Array.isArray(aModified)) return aBase;

            // Se establece una función de recursión profunda para navegar los árboles base y modificado simultáneamente.
            const mergeRecursive = function (baseArray, modArray) {
                // Se itera sobre cada ítem modificado presente en la pantalla.
                modArray.forEach(function (modItem) {
                    // Se localiza su contraparte exacta en el arreglo base (copia de seguridad).
                    const baseItem = baseArray.find(function (b) {
                        return b.name === modItem.name;
                    });

                    // Si el nodo existe en la base, se procede a inyectarle los valores numéricos tecleados.
                    if (baseItem) {
                        for (let key in modItem) {
                            // Se utiliza una expresión regular estricta para identificar únicamente campos anuales (yYYYY) o mensuales (mYYYY_MM), 
                            // además de las estructuras de objetos anidados de meses.
                            if (/^y\d{4}$/.test(key) || /^m\d{4}_\d+$/.test(key) || key === "months" || key === "monthsData") {
                                // Se transfiere el valor actual sobreescribiendo el antiguo en la base de datos local.
                                baseItem[key] = modItem[key];
                            }
                        }
                        // Se delega a los subniveles (categorías) si ambos nodos los contienen.
                        if (baseItem.categories && modItem.categories) {
                            mergeRecursive(baseItem.categories, modItem.categories);
                        }
                    }
                });
            };

            // Se ejecuta la fusión. Al modificar directamente los objetos mutables de 'aBase', esta contendrá la versión final unificada.
            mergeRecursive(aBase, aModified);
            return aBase;
        },
        /**
 * Se compara el arbol actual del modelo con el arbol original del servidor
 * y se devuelve unicamente la lista de valores que han cambiado respecto al origen.
 * Cada entrada del delta contiene la ruta de acceso al nodo, la clave del
 * campo modificado y el nuevo valor introducido por el usuario.
 */
        _computeModelDelta: function (aOriginal, aCurrent, sBasePath) {
            const aDelta = [];
            const sPath = sBasePath || "";

            if (!Array.isArray(aCurrent) || !Array.isArray(aOriginal)) return aDelta;

            const aStructuralKeys = [
                "children", "padre", "isGroup", "expandible", "cabecera",
                "ParentPath", "flag1", "flag2", "flag1Label", "flag2Label",
                "monthsData", "size2"
            ];

            for (let i = 0; i < aCurrent.length; i++) {
                const oCur = aCurrent[i];
                const oOri = aOriginal[i] || {};
                const sNode = sPath + "/" + i;

                Object.keys(oCur).forEach(function (sKey) {
                    if (aStructuralKeys.indexOf(sKey) !== -1) return;

                    const vCur = (oCur[sKey] === undefined || oCur[sKey] === null) ? "" : String(oCur[sKey]);
                    const vOri = (oOri[sKey] === undefined || oOri[sKey] === null) ? "" : String(oOri[sKey]);

                    if (vCur !== vOri) {
                        aDelta.push({ path: sNode, key: sKey, value: oCur[sKey] });
                    }
                });

                if (Array.isArray(oCur.children)) {
                    const aChildDelta = this._computeModelDelta(
                        oOri.children || [],
                        oCur.children,
                        sNode + "/children"
                    );
                    aChildDelta.forEach(function (oEntry) { aDelta.push(oEntry); });
                }
            }

            // Se registran en consola las modificaciones detectadas para facilitar el diagnostico.
            // Se separan las entradas raiz de las entradas de hijos para mayor legibilidad.
            if (sPath === "") {
                if (aDelta.length === 0) {
                    console.log("[VariantDelta] No se han detectado modificaciones respecto al estado original del servidor.");
                } else {
                    console.log("[VariantDelta] Se han detectado " + aDelta.length + " modificacion(es):");
                    aDelta.forEach(function (oEntry, iIdx) {
                        console.log(
                            "  [" + iIdx + "] ruta: " + oEntry.path +
                            " | campo: " + oEntry.key +
                            " | valor nuevo: " + JSON.stringify(oEntry.value)
                        );
                    });
                }
            }

            return aDelta;
        },

        /**
         * Se aplica un delta de cambios sobre una copia fresca de los datos originales
         * del servidor para reconstruir el estado exacto en que el usuario guardo
         * la variante sin necesidad de almacenar el modelo completo.
         */
        _applyModelDelta: function (aDelta) {
            const oModel = this.getView().getModel("corrientesModel");
            if (!oModel) return;

            // Se parte de una copia limpia de los datos del servidor para garantizar
            // que no queden residuos de sesiones anteriores antes de aplicar el delta.
            if (this._originalServerData) {
                const aFresh = JSON.parse(JSON.stringify(this._originalServerData));
                oModel.setData(aFresh);
                oModel.refresh(true);
            }

            // Si el delta esta vacio no hay nada que aplicar: la tabla ya muestra
            // los datos originales del servidor despues del setData anterior.
            if (!Array.isArray(aDelta) || aDelta.length === 0) return;

            // Se aplica cada entrada del delta directamente sobre el modelo recien inicializado.
            aDelta.forEach(function (oEntry) {
                oModel.setProperty(oEntry.path + "/" + oEntry.key, oEntry.value);
            });
        },
        /**
         * Se inicializa el sistema de gestion de variantes.
         * Se captura el estado inicial de la tabla como variante estandar y se
         * carga cualquier variante adicional persistida en el navegador.
         */
        _initVariantManagement: function (sStorageKey) {
            this._variantStorageKey = sStorageKey || "ui5_variants_default";
            this._bVariantDirty = false;

            this._aVariants = this._loadVariantsFromStorage();

            // Se recupera el nombre de la variante marcada como por defecto.
            // Si no hay ninguna guardada se usa la estandar.
            const sDefaultName = localStorage.getItem(this._variantStorageKey + "_default") || "Estándar";
            const oDefaultVariant = this._aVariants.find(function (v) {
                return v.name === sDefaultName;
            }) || this._aVariants[0];

            // Se marca en el array cual es la por defecto.
            this._aVariants.forEach(function (v) { v.isPorDefecto = false; });
            oDefaultVariant.isPorDefecto = true;

            this.getView().setModel(new sap.ui.model.json.JSONModel({
                currentName: oDefaultVariant.name,
                displayLabel: oDefaultVariant.name
            }), "variantModel");

            // Se captura el estado inicial y se aplica la variante por defecto
            // una vez que la tabla esta completamente renderizada.
            setTimeout(function () {
                this._aVariants[0].state = this._getCurrentTableState();

                // Se aplica automaticamente la variante por defecto al arrancar
                // solo si no es la estandar, ya que la estandar es el estado inicial.
                if (oDefaultVariant.name !== "Estándar" && oDefaultVariant.state) {
                    this._bSuppressDirtyFlag = true;
                    this._applyVariantState(oDefaultVariant.state);
                    this.getView().getModel("variantModel").setProperty("/currentName", oDefaultVariant.name);
                    this.getView().getModel("variantModel").setProperty("/displayLabel", oDefaultVariant.name);
                }
            }.bind(this), 500);

            const oTable = this.getControlTable();
            if (oTable && !oTable._variantColumnMoveAttached) {
                oTable.attachColumnMove(function () {
                    this._markVariantDirty();
                }.bind(this));
                oTable._variantColumnMoveAttached = true;
            }
        },

        /**
         * Se marca la variante activa como modificada y se actualiza el indicador
         * visual anadiendo un asterisco al nombre mostrado en el boton selector.
         * Se omite la marca si el sistema ha suspendido temporalmente la deteccion
         * de cambios durante la restauracion de una variante.
         */
        _markVariantDirty: function () {
            // Se ignora la llamada si la supresion temporal esta activa, lo que ocurre
            // durante la restauracion interna de datos al cambiar de variante.
            if (this._bSuppressDirtyFlag) return;
            if (this._bVariantDirty) return;

            this._bVariantDirty = true;

            const oVModel = this.getView().getModel("variantModel");
            if (!oVModel) return;

            // Se anade el asterisco al nombre visible para indicar cambios pendientes.
            const sName = oVModel.getProperty("/currentName");
            oVModel.setProperty("/displayLabel", sName + " *");
        },

        /**
         * Se elimina el indicador de cambios pendientes y se restaura el nombre limpio.
         */
        _clearVariantDirty: function () {
            this._bVariantDirty = false;
            const oVModel = this.getView().getModel("variantModel");
            if (!oVModel) return;
            oVModel.setProperty("/displayLabel", oVModel.getProperty("/currentName"));
        },

        /**
         * Se gestiona el redimensionamiento de columnas realizado por el usuario.
         * Se persiste el nuevo ancho y se marca la variante activa como modificada.
         */
        onColumnResize: function (oEvt) {
            this._markVariantDirty();
        },

/**
 * Se captura el estado completo de la tabla incluyendo el orden de las columnas
 * estaticas, sus anchos, su visibilidad, las filas expandidas, las seleccionadas,
 * el delta de cambios realizados por el usuario en las celdas editables y el estado
 * de los controles auxiliares de ejercicios anteriores y ajustes.
 * El estado de idEjecutadoCheckBox2 se lee desde la variable interna _bEjecutadoSelected
 * ya que dicho control reside en la Main view y no es accesible directamente desde aqui.
 */
_getCurrentTableState: function () {
    const oTable = this.getControlTable();
    if (!oTable) return null;

    // Se capturan las columnas estaticas en el orden actual de la tabla.
    const aColStates = [];
    oTable.getColumns().forEach(function (oCol) {
        if (oCol.data("dynamicYear") || oCol.data("dynamicMonth") || oCol.data("ejecutadosColumn")) {
            return;
        }
        aColStates.push({
            key:     this._getVariantColumnKey(oCol),
            width:   oCol.getWidth(),
            visible: oCol.getVisible()
        });
    }.bind(this));

    // Se capturan las rutas de las filas expandidas.
    const aExpandedPaths = [];
    const oBinding = oTable.getBinding("rows");
    if (oBinding) {
        const iLength = oBinding.getLength();
        for (let i = 0; i < iLength; i++) {
            if (oTable.isExpanded(i)) {
                const oCtx = oTable.getContextByIndex(i);
                if (oCtx) aExpandedPaths.push(oCtx.getPath());
            }
        }
    }

    // Se capturan las rutas de las filas seleccionadas.
    const aSelectedPaths = [];
    oTable.getSelectedIndices().forEach(function (iIdx) {
        const oCtx = oTable.getContextByIndex(iIdx);
        if (oCtx) aSelectedPaths.push(oCtx.getPath());
    });

    // Se calcula el delta de cambios en las celdas respecto a los datos originales del servidor.
    let aModelDelta = [];
    try {
        const oModel = this.getView().getModel("corrientesModel");
        if (oModel && this._originalServerData) {
            aModelDelta = this._computeModelDelta(
                this._originalServerData,
                oModel.getData()
            );
        }
    } catch (e) {
        sap.base.Log.warning("No se pudo calcular el delta del modelo: " + e);
    }

    // Se lee el estado de idEjecutadoCheckBox2 desde la variable interna _bEjecutadoSelected
    // ya que esta variable se mantiene siempre sincronizada con el checkbox por _handleEjecutado
    // y no requiere acceso directo al control que reside en la Main view.
    const bEjecutadoSelected = this._bEjecutadoSelected || false;

    // Se captura el estado de idAjustesCheckBox que pertenece a la vista hija activa.
    const oAjustesCheckBox = this.byId("idAjustesCheckBox");
    const bAjustesSelected = oAjustesCheckBox
        ? oAjustesCheckBox.getSelected()
        : false;

    return {
        columns:            aColStates,
        expandedPaths:      aExpandedPaths,
        selectedPaths:      aSelectedPaths,
        modelDelta:         aModelDelta,
        bEjecutadoSelected: bEjecutadoSelected,
        bAjustesSelected:   bAjustesSelected
    };
},

/**
 * Se aplica un estado de variante guardado a la tabla restaurando el orden,
 * anchos y visibilidad de columnas, los datos editados en las celdas mediante
 * el delta, las filas expandidas y seleccionadas y el estado de los controles
 * auxiliares de ejercicios anteriores y ajustes.
 * Para actualizar visualmente idEjecutadoCheckBox2 se utiliza la retrollamada
 * _fnSetEjecutadoCheckBox inyectada por la Main view al cargar esta vista hija.
 */
_applyVariantState: function (oState) {
    if (!oState) return;
    const oTable = this.getControlTable();
    if (!oTable) return;

    // Se restauran los datos editados en las celdas aplicando el delta sobre
    // los datos originales del servidor.
    if (Array.isArray(oState.modelDelta)) {
        try {
            this._applyModelDelta(oState.modelDelta);
        } catch (e) {
            sap.base.Log.warning("No se pudo restaurar el delta del modelo: " + e);
        }
    }

    // Se restaura el estado de idAjustesCheckBox actualizando el modelo de
    // visibilidad de columnas que controla su visualizacion en la tabla.
    // Este control pertenece a la vista hija activa y se localiza directamente.
    if (typeof oState.bAjustesSelected === "boolean") {
        const oAjustesCheckBox = this.byId("idAjustesCheckBox");
        if (oAjustesCheckBox) {
            oAjustesCheckBox.setSelected(oState.bAjustesSelected);
        }
        const oVisibleModel = this.getView().getModel("visibleColumn");
        if (oVisibleModel) {
            oVisibleModel.setProperty("/visible", oState.bAjustesSelected);
        }
    }

    // Se restaura el estado de idEjecutadoCheckBox2 utilizando la retrollamada
    // inyectada por la Main view, ya que ese control reside en ella y no en esta
    // vista hija. Se ejecuta antes de restaurar las columnas estaticas para que
    // _handleEjecutado reconstruya correctamente las columnas dinamicas de ejecutados.
    if (typeof oState.bEjecutadoSelected === "boolean") {
        if (this._fnSetEjecutadoCheckBox) {
            this._fnSetEjecutadoCheckBox(oState.bEjecutadoSelected);
        }
        this._bEjecutadoSelected = oState.bEjecutadoSelected;
        this._handleEjecutado(oState.bEjecutadoSelected);
    }

    // Se restauran orden, ancho y visibilidad de las columnas estaticas.
    if (oState.columns && oState.columns.length > 0) {
        const aStaticCols = oTable.getColumns().filter(function (oCol) {
            return !oCol.data("dynamicYear") && !oCol.data("dynamicMonth") && !oCol.data("ejecutadosColumn");
        });

        const oKeyToCol = {};
        aStaticCols.forEach(function (oCol) {
            oKeyToCol[this._getVariantColumnKey(oCol)] = oCol;
        }.bind(this));

        aStaticCols.forEach(function (oCol) {
            oTable.removeColumn(oCol);
        });

        oState.columns.forEach(function (oSaved, iPos) {
            const oCol = oKeyToCol[oSaved.key];
            if (oCol) {
                oCol.setWidth(oSaved.width);
                oCol.setVisible(oSaved.visible);
                oTable.insertColumn(oCol, iPos);
            }
        });
    }

    // Se restauran las expansiones y selecciones una vez que el DOM se ha estabilizado.
    // La supresion del indicador de cambios se mantiene activa durante todo el proceso
    // asincrono para evitar que las operaciones internas activen el marcador de
    // variante modificada de forma involuntaria.
    const fnRestoreTreeState = function () {
        const oBinding = oTable.getBinding("rows");
        if (!oBinding) return;

        const iLength = oBinding.getLength();
        oTable.collapseAll();
        oTable.clearSelection();

        const oPathToIndex = {};
        for (let i = 0; i < iLength; i++) {
            const oCtx = oTable.getContextByIndex(i);
            if (oCtx) oPathToIndex[oCtx.getPath()] = i;
        }

        // Se expanden las filas que estaban abiertas en el momento del guardado.
        if (Array.isArray(oState.expandedPaths)) {
            oState.expandedPaths.forEach(function (sPath) {
                const iIdx = oPathToIndex[sPath];
                if (iIdx !== undefined) oTable.expand(iIdx);
            });
        }

        // Se restauran las filas seleccionadas tras un ciclo adicional para garantizar
        // que las expansiones anteriores hayan actualizado el indice de filas visibles.
        if (Array.isArray(oState.selectedPaths) && oState.selectedPaths.length > 0) {
            setTimeout(function () {
                const iLengthAfterExpand = oBinding.getLength();
                for (let i = 0; i < iLengthAfterExpand; i++) {
                    const oCtx = oTable.getContextByIndex(i);
                    if (oCtx && oState.selectedPaths.indexOf(oCtx.getPath()) !== -1) {
                        oTable.addSelectionInterval(i, i);
                    }
                }
                // Se reactiva el detector de cambios una vez que todas las operaciones
                // asincronas de restauracion han concluido, incluidas las selecciones.
                this._bSuppressDirtyFlag = false;
            }.bind(this), 150);
        } else {
            // Si no existen filas seleccionadas que restaurar, se reactiva el detector
            // de cambios inmediatamente despues de procesar las expansiones.
            this._bSuppressDirtyFlag = false;
        }
    }.bind(this);

    setTimeout(fnRestoreTreeState, 100);
},

        /**
         * Se construye una clave estable para identificar una columna dentro de una variante.
         */
        _getVariantColumnKey: function (oCol) {
            const sFilter = oCol.getFilterProperty && oCol.getFilterProperty();
            if (sFilter) return sFilter;
            const sId = oCol.getId() || "";
            return sId.split("--").pop() || sId;
        },

        /**
         * Se abre el popover de seleccion de variantes.
         * Cuando la variante activa no es la estandar y tiene cambios pendientes
         * se muestra un boton adicional para guardar directamente sin pedir nombre.
         */
        onOpenVariantPopover: function (oEvt) {
            const oSource = oEvt.getSource();
            const oVModel = this.getView().getModel("variantModel");
            const that = this;

            if (this._oVariantPopover) {
                this._oVariantPopover.destroy();
                this._oVariantPopover = null;
            }

            const oList = new sap.m.List({ showSeparators: "None" });

            this._aVariants.forEach(function (oVar) {
                const bActiva = oVar.name === oVModel.getProperty("/currentName");
                const oItem = new sap.m.StandardListItem({
                    title: oVar.name,
                    type: "Active",
                    highlight: bActiva ? "Information" : "None"
                });
                oItem.attachPress(function () {
                    that._oVariantPopover.close();
                    that._switchToVariant(oVar);
                });
                oList.addItem(oItem);
            });

            // Se determina si la variante activa es la estandar para decidir si
            // se muestra el boton de guardado directo.
            const sCurrentName = oVModel.getProperty("/currentName");
            const oCurrentVariant = this._aVariants.find(function (v) { return v.name === sCurrentName; });
            const bIsDefault = oCurrentVariant && oCurrentVariant.isDefault;
            const bShowSave = !bIsDefault && this._bVariantDirty;

            const aFooterContent = [];

            // Se anade el boton de guardado directo solo cuando procede.
            if (bShowSave) {
                aFooterContent.push(new sap.m.Button({
                    text: "Guardar",
                    type: "Emphasized",
                    press: function () {
                        that._oVariantPopover.close();

                        // Se sobreescribe el estado de la variante activa con la configuracion actual.
                        const oCurrentState = that._getCurrentTableState();
                        if (oCurrentVariant) {
                            oCurrentVariant.state = oCurrentState;
                        }
                        that._saveVariantsToStorage();
                        oVModel.setProperty("/displayLabel", sCurrentName);
                        that._bVariantDirty = false;
                    }
                }));
            }

            aFooterContent.push(new sap.m.Button({
                text: "Guardar con nombre",
                type: bShowSave ? "Default" : "Emphasized",
                press: function () {
                    that._oVariantPopover.close();
                    that.onSaveVariantAs();
                }
            }));

            aFooterContent.push(new sap.m.ToolbarSpacer());

            aFooterContent.push(new sap.m.Button({
                text: "Gestionar",
                press: function () {
                    that._oVariantPopover.close();
                    that.onManageVariants();
                }
            }));

            const oFooter = new sap.m.Toolbar({ content: aFooterContent });

            this._oVariantPopover = new sap.m.Popover({
                title: "Mis vistas",
                contentWidth: "300px",
                content: [oList],
                footer: oFooter,
                afterClose: function () {
                    if (that._oVariantPopover) {
                        that._oVariantPopover.destroy();
                        that._oVariantPopover = null;
                    }
                }
            });

            this.getView().addDependent(this._oVariantPopover);
            this._oVariantPopover.openBy(oSource);
        },

        /**
         * Se cambia a la variante seleccionada aplicando su estado guardado a la tabla.
         * Si hay cambios pendientes sin guardar se solicita confirmacion al usuario
         * antes de proceder para evitar la perdida accidental de modificaciones.
         */
        _switchToVariant: function (oVar) {
            const oVModel = this.getView().getModel("variantModel");
            const that = this;

            // Se verifica si la variante destino es la misma que la activa para evitar
            // operaciones innecesarias al pulsar sobre la variante ya seleccionada.
            if (oVar.name === oVModel.getProperty("/currentName") && !this._bVariantDirty) {
                return;
            }

            // Se muestra un dialogo de confirmacion si hay cambios pendientes sin guardar.
            if (this._bVariantDirty) {
                sap.m.MessageBox.confirm(
                    "Existen cambios sin guardar en la vista actual. Si continua, se perderan las modificaciones no guardadas.",
                    {
                        title: "Cambios sin guardar",
                        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                        emphasizedAction: sap.m.MessageBox.Action.CANCEL,
                        onClose: function (sAction) {
                            if (sAction !== sap.m.MessageBox.Action.OK) return;
                            that._doSwitchToVariant(oVar);
                        }
                    }
                );
                return;
            }

            // Si no hay cambios pendientes se aplica el cambio directamente.
            this._doSwitchToVariant(oVar);
        },

/**
 * Se ejecuta el cambio efectivo de variante una vez confirmado por el usuario.
 * Se suspende temporalmente el detector de cambios del modelo para evitar que
 * la restauracion de datos dispare el indicador de modificaciones pendientes.
 * Al volver a la variante estandar sin estado guardado se resetean ambos controles
 * utilizando la retrollamada _fnSetEjecutadoCheckBox para el checkbox de la Main view.
 */
_doSwitchToVariant: function (oVar) {
    const oVModel = this.getView().getModel("variantModel");

    // Se desactiva el indicador de cambios pendientes y se activa la supresion
    // para que ninguna operacion interna de restauracion lo vuelva a encender.
    this._bVariantDirty      = false;
    this._bSuppressDirtyFlag = true;

    if (oVar.state) {
        this._applyVariantState(oVar.state);
    } else if (this._originalServerData) {
        // Se restauran los datos originales del servidor si la variante no
        // tiene estado guardado, como ocurre con la variante estandar inicial.
        const oModel = this.getView().getModel("corrientesModel");
        if (oModel) {
            oModel.setData(JSON.parse(JSON.stringify(this._originalServerData)));
            oModel.refresh(true);
        }

        // Se resetea idEjecutadoCheckBox2 mediante la retrollamada inyectada por
        // la Main view, ya que ese control reside en ella y no en esta vista hija.
        if (this._bEjecutadoSelected) {
            if (this._fnSetEjecutadoCheckBox) {
                this._fnSetEjecutadoCheckBox(false);
            }
            this._bEjecutadoSelected = false;
            this._handleEjecutado(false);
        }

        // Se resetea idAjustesCheckBox que pertenece a la vista hija activa
        // y se actualiza el modelo de visibilidad de columnas correspondiente.
        const oAjustesCheckBox = this.byId("idAjustesCheckBox");
        if (oAjustesCheckBox && oAjustesCheckBox.getSelected()) {
            oAjustesCheckBox.setSelected(false);
            const oVisibleModel = this.getView().getModel("visibleColumn");
            if (oVisibleModel) {
                oVisibleModel.setProperty("/visible", false);
            }
        }

        // Se libera la supresion tras un ciclo minimo de renderizado ya que
        // en este caso no existen operaciones asincronas adicionales pendientes.
        setTimeout(function () {
            this._bSuppressDirtyFlag = false;
        }.bind(this), 100);
    }

    // Se actualiza el nombre activo en el modelo de variantes y se elimina
    // el asterisco de cambios pendientes del boton selector.
    oVModel.setProperty("/currentName",  oVar.name);
    oVModel.setProperty("/displayLabel", oVar.name);
},

/**
 * Se abre el dialogo para guardar la configuracion actual con un nombre personalizado.
 * Incluye la opcion para definir la variante como estandar al guardar.
 */
onSaveVariantAs: function () {
    const oVModel = this.getView().getModel("variantModel");
    const that = this;

    const oInput = new sap.m.Input({
        value: oVModel.getProperty("/currentName"),
        placeholder: "Nombre de la vista",
        width: "100%"
    });

    // Se crea la casilla para definir la variante como estandar al guardar.
    const oCheckDefault = new sap.m.CheckBox({
        text: "Definir como estándar",
        selected: false
    });

    const oDialog = new sap.m.Dialog({
        title: "Guardar vista",
        contentWidth: "320px",
        content: [
            new sap.m.VBox({
                renderType: "Bare",
                items: [
                    new sap.m.Label({ text: "Vista", labelFor: oInput }),
                    oInput,
                    oCheckDefault
                ]
            }).addStyleClass("sapUiSmallMargin")
        ],
        beginButton: new sap.m.Button({
            text: "Guardar",
            type: "Emphasized",
            press: function () {
                const sName = (oInput.getValue() || "").trim();
                if (!sName) return;

                // Se captura el estado actual de la tabla en el momento del guardado.
                const oCurrentState = that._getCurrentTableState();

                // Se sobreescribe si ya existe una variante con el mismo nombre.
                const iExisting = that._aVariants.findIndex(function (v) {
                    return v.name === sName;
                });
                if (iExisting >= 0) {
                    that._aVariants[iExisting].state = oCurrentState;
                } else {
                    that._aVariants.push({
                        name: sName,
                        state: oCurrentState
                    });
                }

                // Si el usuario marco la casilla de estandar se actualiza el por defecto.
                if (oCheckDefault.getSelected()) {
                    that._aVariants.forEach(function (v) { v.isPorDefecto = false; });
                    const oNewVar = that._aVariants.find(function (v) {
                        return v.name === sName;
                    });
                    if (oNewVar) oNewVar.isPorDefecto = true;
                }

                that._saveVariantsToStorage();

                // Se actualiza el nombre activo y se elimina el indicador de cambios.
                oVModel.setProperty("/currentName", sName);
                oVModel.setProperty("/displayLabel", sName);
                that._bVariantDirty = false;

                oDialog.close();
            }
        }),
        endButton: new sap.m.Button({
            text: "Cancelar",
            press: function () { oDialog.close(); }
        }),
        afterClose: function () { oDialog.destroy(); }
    });

    this.getView().addDependent(oDialog);
    oDialog.open();
},


/**
 * Se abre el dialogo de gestion de variantes con estructura de tabla
 * similar al componente nativo de SAP, incluyendo busqueda, columnas
 * de por defecto y creado por, con posibilidad de eliminar las variantes
 * propias y establecer una como predeterminada.
 */
onManageVariants: function () {
    const oVModel = this.getView().getModel("variantModel");
    const that = this;

    // Se crea el modelo interno del dialogo con una copia de las variantes actuales
    // para poder editar sin afectar el estado real hasta que el usuario confirme.
    const aDialogData = this._aVariants.map(function (oVar) {
        return {
            name: oVar.name,
            isDefault: oVar.isDefault || false,
            isPorDefecto: oVar.isPorDefecto || false,
            createdBy: oVar.isDefault ? "SAP" : "Usted",
            ref: oVar
        };
    });

    // Se construye la cabecera de columnas de la tabla de gestion sin la columna
    // de compartimiento ya que la visibilidad publica o privada no es necesaria.
    const oTable = new sap.m.Table({
        showSeparators: "All",
        mode: "None",
        columns: [
            new sap.m.Column({ width: "2rem" }),
            new sap.m.Column({
                header: new sap.m.Label({ text: "Vista" })
            }),
            new sap.m.Column({
                header: new sap.m.Label({ text: "Por defecto" }),
                width: "6rem",
                hAlign: "Center"
            }),
            new sap.m.Column({
                header: new sap.m.Label({ text: "Creado por" }),
                width: "6rem"
            }),
            new sap.m.Column({ width: "2rem" })
        ]
    });

    // Se define la funcion auxiliar que construye el icono de estrella para cada fila.
    const fnBuildStarIcon = function (oItemRef) {
        const oIcon = new sap.ui.core.Icon({
            src: "sap-icon://favorite",
            color: oItemRef.isPorDefecto ? "#0070f2" : "#c0c0c0"
        }).addStyleClass("sapUiTinyMarginTop");

        // Se asigna el handler de pulsacion solo si la variante no es ya la por defecto.
        if (!oItemRef.isPorDefecto) {
            oIcon.attachPress(function () {
                aDialogData.forEach(function (v) { v.isPorDefecto = false; });
                oItemRef.isPorDefecto = true;
                fnRefreshStarsAndRadios();
            });
            oIcon.addStyleClass("sapUiPointer");
        }

        return oIcon;
    };

    // Se define la funcion que actualiza unicamente el color de las estrellas y el
    // estado de los radio buttons sin destruir ni recrear ninguna fila de la tabla.
    const fnRefreshStarsAndRadios = function () {
        oTable.getItems().forEach(function (oRow) {
            const oItemRef = oRow.data("itemRef");
            if (!oItemRef) return;

            const oCells = oRow.getCells();

            // Se actualiza el color de la estrella y su capacidad de pulsacion.
            const oStar = oCells[0];
            if (oStar && oStar.isA("sap.ui.core.Icon")) {
                oStar.setColor(oItemRef.isPorDefecto ? "#0070f2" : "#c0c0c0");
                if (oItemRef.isPorDefecto) {
                    oStar.removeStyleClass("sapUiPointer");
                    oStar.detachPress(oStar._fnStarPress);
                    oStar._fnStarPress = null;
                } else if (!oStar._fnStarPress) {
                    oStar._fnStarPress = function () {
                        aDialogData.forEach(function (v) { v.isPorDefecto = false; });
                        oItemRef.isPorDefecto = true;
                        fnRefreshStarsAndRadios();
                    };
                    oStar.attachPress(oStar._fnStarPress);
                    oStar.addStyleClass("sapUiPointer");
                }
            }

            // Se actualiza el radio button sin recrear la fila.
            // La columna de por defecto es ahora el indice 2 al haberse eliminado
            // la columna de compartimiento que ocupaba ese puesto anteriormente.
            const oRadio = oCells[2];
            if (oRadio && oRadio.isA("sap.m.RadioButton")) {
                oRadio.setSelected(oItemRef.isPorDefecto);
            }
        });
    };

    // Se define la funcion que construye y anade una sola fila a la tabla.
    const fnBuildRow = function (oItem) {
        const oRow = new sap.m.ColumnListItem({
            cells: [
                // Se construye la estrella mediante la funcion auxiliar.
                fnBuildStarIcon(oItem),

                // Se muestra el nombre de la variante, editable si no es estandar.
                oItem.isDefault
                    ? new sap.m.Text({ text: oItem.name }).addStyleClass("sapMTextBold")
                    : new sap.m.Input({
                        value: oItem.name,
                        width: "100%",
                        change: function (oEvt) {
                            // Se actualiza el nombre directamente en el objeto de datos
                            // de esta fila sin afectar a las demas filas de la tabla.
                            oItem.name = oEvt.getParameter("value");
                        }
                    }),

                // Se muestra el radio button de por defecto.
                new sap.m.RadioButton({
                    selected: oItem.isPorDefecto,
                    groupName: "variantDefault",
                    select: function () {
                        aDialogData.forEach(function (v) { v.isPorDefecto = false; });
                        oItem.isPorDefecto = true;
                        fnRefreshStarsAndRadios();
                    }
                }),

                new sap.m.Text({ text: oItem.createdBy }),

                // Se muestra el icono de eliminacion solo para las variantes propias.
                oItem.isDefault
                    ? new sap.m.Text({ text: "" })
                    : new sap.ui.core.Icon({
                        src: "sap-icon://delete",
                        color: "#0070f2",
                        press: function () {
                            // Se elimina el item del array de datos.
                            const iIdx = aDialogData.indexOf(oItem);
                            if (iIdx >= 0) aDialogData.splice(iIdx, 1);

                            // Se elimina unicamente esta fila de la tabla
                            // sin recrear ni tocar ninguna otra fila.
                            oTable.removeItem(oRow);
                            oRow.destroy();
                        }
                    }).addStyleClass("sapUiTinyMarginTop sapUiPointer")
            ]
        });

        // Se almacena una referencia directa al objeto de datos en la fila.
        oRow.data("itemRef", oItem);

        return oRow;
    };

    // Se define la funcion que filtra las filas visibles segun la busqueda.
    const fnApplyFilter = function (sQuery) {
        oTable.getItems().forEach(function (oRow) {
            const oItemRef = oRow.data("itemRef");
            if (!oItemRef) return;
            const bVisible = !sQuery ||
                oItemRef.name.toLowerCase().indexOf(sQuery.toLowerCase()) !== -1;
            oRow.setVisible(bVisible);
        });
    };

    // Se pintan todas las filas una sola vez al abrir el dialogo.
    aDialogData.forEach(function (oItem) {
        oTable.addItem(fnBuildRow(oItem));
    });

    // Se construye la barra de busqueda superior del dialogo.
    const oSearchField = new sap.m.SearchField({
        placeholder: "Buscar",
        width: "100%",
        search: function (oEvt) {
            fnApplyFilter(oEvt.getParameter("query") || "");
        },
        liveChange: function (oEvt) {
            fnApplyFilter(oEvt.getParameter("newValue") || "");
        }
    });

    const oDialog = new sap.m.Dialog({
        title: "Gestionar vistas",
        resizable: true,
        draggable: true,
        contentWidth: "500px",
        contentHeight: "350px",
        content: [
            new sap.m.VBox({
                items: [oSearchField, oTable]
            })
        ],
        beginButton: new sap.m.Button({
            text: "Guardar",
            type: "Emphasized",
            press: function () {
                // Se aplican los cambios de nombre y por defecto al array real de variantes.
                aDialogData.forEach(function (oItem) {
                    const oReal = oItem.ref;
                    if (oReal) {
                        oReal.name = oItem.name;
                        oReal.isPorDefecto = oItem.isPorDefecto;
                    }
                });

                // Se eliminan del array real las variantes que el usuario borro en el dialogo.
                that._aVariants = that._aVariants.filter(function (oVar) {
                    return aDialogData.some(function (oItem) { return oItem.ref === oVar; });
                });

                // Se verifica si la variante activa fue eliminada y en ese caso
                // se cambia automaticamente a la estandar para evitar un estado inconsistente.
                const sCurrentName = oVModel.getProperty("/currentName");
                const bCurrentStillExists = that._aVariants.some(function (v) {
                    return v.name === sCurrentName;
                });
                if (!bCurrentStillExists) {
                    that._doSwitchToVariant(that._aVariants[0]);
                }

                that._saveVariantsToStorage();
                oDialog.close();
            }
        }),
        endButton: new sap.m.Button({
            text: "Cancelar",
            press: function () { oDialog.close(); }
        }),
        afterClose: function () { oDialog.destroy(); }
    });

    this.getView().addDependent(oDialog);
    oDialog.open();
},

        /**
         * Se persisten en el almacenamiento local las variantes no estandar.
         */
        _saveVariantsToStorage: function () {
            try {
                const aToSave = this._aVariants.filter(function (v) { return !v.isDefault; });
                // Se guarda tambien el nombre de la variante marcada como por defecto
                // para poder restaurarla automaticamente al recargar la pagina.
                const sDefaultVariant = (this._aVariants.find(function (v) {
                    return v.isPorDefecto;
                }) || {}).name || "Estándar";

                localStorage.setItem(this._variantStorageKey, JSON.stringify(aToSave));
                localStorage.setItem(this._variantStorageKey + "_default", sDefaultVariant);
            } catch (e) {
                sap.base.Log.warning("No se pudo guardar la variante: " + e);
            }
        },

        /**
         * Se recuperan del almacenamiento local las variantes guardadas.
         * Se devuelve siempre la variante estandar en primera posicion.
         */
        _loadVariantsFromStorage: function () {
            const aResult = [{ name: "Estándar", state: null, isDefault: true }];
            try {
                const sRaw = localStorage.getItem(this._variantStorageKey);
                if (sRaw) {
                    const aParsed = JSON.parse(sRaw);
                    if (Array.isArray(aParsed)) {
                        aParsed.forEach(function (v) { aResult.push(v); });
                    }
                }
            } catch (e) {
                sap.base.Log.warning("No se pudieron cargar las variantes: " + e);
            }
            return aResult;
        },
        /**
         * Se instancia un diálogo de mensajes global y se ancla al ciclo de vida de la vista actual.
         */
        createMessageDialog: function (options) {
            // Se utiliza el fragmento precargado para crear físicamente el control del diálogo.
            const mDialog = messageDialog.createDialog(options, this);
            // Se añade como dependiente para asegurar el enrutamiento de modelos y su destrucción automática con la vista.
            this.getView().addDependent(mDialog);
            mDialog.open();
            return mDialog;
        },

        /**
         * Se recuperan los textos traducidos utilizando la clave proporcionada en el archivo de internacionalización (i18n).
         */
        getTranslatedText: function (key) {
            // Se extrae la cadena textual del paquete de recursos alojado a nivel global en el componente.
            return this.getGlobalModel("i18n").getResourceBundle().getText(key);
        },

        /**
         * Se abre el selector genérico estandarizado pasándole configuración (columnas, título) y los datos en formato JSON.
         */
        openSelectorDialog: function (options, data) {
            // Se comprueba si ya existía una instancia viva para destruirla y evitar memoria fantasma (memory leaks).
            if (this.selectorDialog) {
                this.selectorDialog.destroy();
            }
            // Se crea el diálogo y se le asocia un modelo plano estructurado.
            this.selectorDialog = selectorDialog.createDialog(options, this);
            const oModel = new JSONModel({ data: data });
            this.selectorDialog.setModel(oModel);
            this.getView().addDependent(this.selectorDialog);
            this.selectorDialog.open();
            return this.selectorDialog;
        },

        /**
         * Se recuperan los tramos asociados a una obra específica realizando una llamada al servicio back-end.
         */
        getTramosByObra: async function (obra) {
            // Se ejecuta una petición POST enrutando la carga útil al OData respectivo y adjuntando cabeceras personalizadas.
            return this.post(
                this.getGlobalModel("mainService"),
                "/SelectTramosSet",
                {
                    "NavTramosProy": [],
                    "NavTramosDatos": []
                },
                {
                    headers: {
                        ambito: obra, // Parámetro crítico que define el entorno organizacional.
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                    }
                }
            );
        },

        /**
         * Se recuperan los datos de accesos indirectos correspondientes al entorno de la obra.
         */
        getAccesoIndirectos: async function (obra) {
            return this.post(
                this.getGlobalModel("mainService"),
                "/AccesoIndirectosSet",
                {
                    "NavMasterLt": []
                },
                {
                    headers: {
                        ambito: obra,
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                    }
                }
            );
        },

        /**
         * Se procesa la selección nativa de filas dentro de la tabla.
         * Su propósito es mantener sincronizados los checkboxes de nivel profundo, propagando selecciones de forma masiva si procede.
         */
        onRowSelectionChange: function (oEvent) {
            // Se implementa un bloqueo ('_lock') tipo Mutex rudimentario. Como esta función programa modificaciones sobre la propia tabla, 
            // se evita que los cambios programáticos re-disparen este mismo evento provocando bucles infinitos (Stack Overflow).
            if (this._lock) return;
            this._lock = true;
            // Se marca la variante activa como modificada al cambiar la seleccion.
            this._markVariantDirty();

            const oTable = oEvent.getSource();
            // Se captura el listado de índices afectados por la acción reciente del usuario.
            const aIndices = oEvent.getParameter("rowIndices");

            if (!aIndices || !aIndices.length) {
                this._lock = false;
                return;
            }

            const iRow = aIndices[0];
            const oCtx = oTable.getContextByIndex(iRow);

            if (!oCtx) {
                this._lock = false;
                return;
            }

            // Se inspecciona el estado visual de la fila (si fue marcada o desmarcada).
            const bSelected = oTable.isIndexSelected(iRow);
            const iLen = oTable.getBinding("rows").getLength();
            const sPath = oCtx.getPath();
            // Se deduce la profundidad en el árbol semántico contando las ocurrencias del segmento '/categories'.
            const iLevel = sPath.split("/categories").length - 1;

            // Se aplica una lógica de negocio restrictiva: las selecciones múltiples vinculadas se ejecutan desde un subnivel profundo.
            if (iLevel >= 3) {
                const sParentPath = sPath.substring(0, sPath.lastIndexOf("/categories"));
                let firstChildIndex = null;

                // Paso 1: Localizar la primera fila hermana (el primer nodo que comparte el mismo padre) dentro del viewport.
                for (let j = 0; j < iLen; j++) {
                    const oCtx2 = oTable.getContextByIndex(j);
                    if (!oCtx2) continue;

                    const sP = oCtx2.getPath();
                    const iLvl = sP.split("/categories").length - 1;

                    // Si posee la misma profundidad y comparte la ruta paterna, es un hermano primario.
                    if (iLvl === iLevel && sP.startsWith(sParentPath + "/categories")) {
                        firstChildIndex = j;
                        break;
                    }
                }

                // Paso 2: Si el usuario ha clicado sobre el PRIMER hermano explícitamente, se propaga la selección al resto del bloque fraterno.
                if (firstChildIndex === iRow) {
                    for (let k = 0; k < iLen; k++) {
                        const oCtx3 = oTable.getContextByIndex(k);
                        if (!oCtx3) continue;

                        const sP3 = oCtx3.getPath();
                        const iLvl3 = sP3.split("/categories").length - 1;

                        // Si la fila iterada es un hermano válido, se fuerza programáticamente la selección.
                        if (iLvl3 === iLevel && sP3.startsWith(sParentPath + "/categories")) {
                            if (bSelected) {
                                oTable.addSelectionInterval(k, k); // Marca
                            } else {
                                oTable.removeSelectionInterval(k, k); // Desmarca
                            }
                        }
                    }
                }

                // Se levanta el candado para permitir próximas interacciones.
                this._lock = false;
                return;
            }

            // Si la selección no cayó en un rango con lógica vinculante, se finaliza el proceso rutinario.
            this._lock = false;
        },

        /**
         * Se genera una captura (snapshot) profunda del modelo actual.
         * Sirve como punto de restauración y como punto de referencia para calcular deltas (cambios no guardados).
         */
        _createSnapshot: function () {
            const oModel = this.getView().getModel();
            if (oModel) {
                // Se genera un clon profundo empleando la combinación parse-stringify para evitar paso por referencia.
                this._originalData = JSON.parse(JSON.stringify(oModel.getData()));
            }
        },

        /**
         * Se restauran todos los controles dinámicos y se sobrescriben con la captura original.
         * Anula efectivamente cualquier edición en vivo del usuario que no haya sido persistida (Guardada).
         */
        resetInputs: function () {
            if (!this._originalData) return;
            const oDefaultModel = this.getView().getModel();

            // Se emplea el extensor profundo de jQuery para construir un nuevo objeto limpio e independiente basado en el snapshot.
            const oResetCopy = jQuery.extend(true, {}, this._originalData);
            oDefaultModel.setData(oResetCopy);
            // Se fuerza al motor reactivo de SAPUI5 a repintar todos los binding afectados.
            oDefaultModel.refresh(true);
        },

        /**
         * Se evalúa de manera meticulosa si el estado actual contiene modificaciones que difieran del snapshot.
         */
        hasUnsavedChanges: function () {
            // Si nunca se tomó una instantánea o el modelo está corrupto, se asume que no hay diferencias procesables.
            if (!this._originalData) return false;
            const oDefaultModel = this.getView().getModel();
            if (!oDefaultModel) return false;

            const aCurrentCat = oDefaultModel.getProperty("/catalog/models/categories");
            const aOriginalCat = this._originalData.catalog.models.categories;

            // Función local de limpieza de formato. Las interfaces de entrada humana o el motor de formato suelen arrojar 
            // diferencias cosméticas (0,00 vs 0). Esta rutina nivela la comparación reduciéndolas a falsies ("").
            const normalize = function (val) {
                if (val === undefined || val === null || val === "") return "";

                // Si el valor viene envuelto en un arreglo, se reduce uniendo y podando caracteres basura.
                if (Array.isArray(val)) {
                    const sJoined = val.join("").replace(/,/g, "").trim();
                    return (sJoined === "" || /^0+$/.test(sJoined)) ? "" : sJoined;
                }

                // Normalización de números en crudo.
                const sVal = val.toString().trim();
                // Si el valor detectado denota un cero absoluto ("0", "0.00", "0,0"), se asimila con un valor vacío.
                if (sVal === "0" || sVal === "0.0" || sVal === "0,0" || /^0+(?:[.,]0+)*$/.test(sVal) || /^0+(?:,0+)*$/.test(sVal)) {
                    return "";
                }
                return sVal;
            };

            // Función recursiva que inspecciona y compara cada nodo entre el modelo vivo y el modelo congelado.
            const checkRecursive = function (aCurrent, aOriginal, sPath) {
                if (!aCurrent) return false;

                for (let i = 0; i < aCurrent.length; i++) {
                    const oCur = aCurrent[i];
                    // Se protege el acceso al array original para mitigar casos de nodos que fueron introducidos de cero por el usuario.
                    const oOri = (aOriginal && aOriginal[i]) ? aOriginal[i] : {};
                    const currentPath = sPath + " -> " + (oCur.name || i);

                    for (let key in oCur) {
                        // Solo se detectan discrepancias en los campos de captura de datos (Y2025, M2025_01).
                        if (/^y\d{4}$/.test(key) || /^m\d{4}_\d+$/.test(key)) {
                            // Se aplica la comparativa sobre los valores purgados y normalizados.
                            if (normalize(oCur[key]) !== normalize(oOri[key])) {
                                return true; // Diferencia matemática confirmada.
                            }
                        }

                        // Inspección en profundidad en atributos anidados como 'months'
                        if (key === "months" && oCur[key] && typeof oCur[key] === "object") {
                            for (let mKey in oCur[key]) {
                                const vCurM = normalize(oCur[key][mKey]);
                                const vOriM = (oOri.months) ? normalize(oOri.months[mKey]) : "";

                                if (vCurM !== vOriM) {
                                    return true;
                                }
                            }
                        }
                    }

                    // Se delega a los subgrupos (categories) y se propaga cualquier falso positivo retornado.
                    if (oCur.categories && Array.isArray(oCur.categories) && oCur.categories.length > 0) {
                        if (checkRecursive(oCur.categories, oOri.categories, currentPath)) {
                            return true;
                        }
                    }
                }
                // Si todo el árbol se navegó exitosamente sin incidencias, el formulario está "limpio".
                return false;
            };

            // Se dispara la validación desde la raíz global del catálogo.
            return checkRecursive(aCurrentCat, aOriginalCat, "Root");
        },

        /**
         * Se activa la aplicación algorítmica de la inflación o se restauran los valores crudos, tras interactuar con la casilla respectiva en las filas.
         */
        onInflacionCheckBoxSelect: function (oEvent) {
            const oCheckBox = oEvent.getSource();
            // Se identifica la decisión booleana del usuario.
            const bSelected = oCheckBox.getSelected();
            // Se intercepta el contexto atado al renglón de la tabla que alberga este componente específico.
            const oCtx = oCheckBox.getBindingContext();

            if (!oCtx) return;

            const sPath = oCtx.getPath();
            // Si ha decidido activar la inflación para la fila, se dirige el flujo de cálculos.
            if (bSelected) {
                this._applyInflacionToRow(sPath);
            }
            // Si el usuario se retracta, se purga la inflación calculada devolviendo los números originales.
            else {
                this._restoreInflacionRow(sPath);
            }
        },

        /**
         * Se procesan los cambios manuales en el campo genérico de cabecera de la inflación (Header Input).
         * Dispara una re-validación masiva en cascada a todos los renglones implicados.
         */
        oninflacionInputChange: function (oEvent) {
            const oInput = oEvent.getSource();
            // Se parsea y protege la entrada asegurando siempre un valor flotante válido (0 en caso de error o NaN).
            const fValue = parseFloat(oInput.getValue()) || 0;

            // Se actualiza el Input nativo forzando el formato a dos posiciones decimales estrictas.
            oInput.setValue(fValue.toFixed(2));

            const oModel = this.getView().getModel();
            const aCategories = oModel.getProperty("/catalog/models/categories");
            const that = this; // Se retiene el contexto en una variable para sortear los límites de la función recursiva.

            // Función exploradora para revisar cada nodo del árbol.
            const recalculate = function (aNodes) {
                if (!Array.isArray(aNodes)) return;

                aNodes.forEach(function (oNode) {
                    // Si el nodo actual está marcado internamente con el indicador `flag2` (Checkbox de inflación habilitado).
                    if (oNode.flag2 === true) {
                        // Se deduce la ruta vinculante navegando estructuralmente por el modelo.
                        const sPath = that._findPathByNode(oNode, aCategories);
                        if (sPath) {
                            // Secuencia estricta de actualización matemática:
                            // 1. Se retiran los efectos de la inflación vieja (restauración del valor neto).
                            that._restoreInflacionRow(sPath, true);
                            // 2. Se inyecta la inflación nueva recién capturada en la variable 'fValue'.
                            that._applyInflacionToRow(sPath);
                        }
                    }
                    // Desplazamiento recursivo natural.
                    if (Array.isArray(oNode.categories)) {
                        recalculate(oNode.categories);
                    }
                });
            };

            // Se inicia la avalancha de cálculos.
            recalculate(aCategories);
        },

        /**
                * Se aplica la fórmula de inflación al registro asociado (fila).
                * Toma el valor digitado en el campo general y lo multiplica por los valores base.
                */
        _applyInflacionToRow: function (sPath) {
            const oModel = this.getView().getModel();
            const oRow = oModel.getProperty(sPath);

            // Se valida que la ruta proporcionada devuelva un objeto válido.
            if (!oRow) return;

            // Se recupera el valor de inflación ingresado por el usuario en la cabecera.
            const oInputInflacion = this.byId("inflacionInput");
            const fInflacion = parseFloat(oInputInflacion ? oInputInflacion.getValue() : 0) || 0;

            // Se inicializa el objeto global de respaldo si es la primera vez que se aplica inflación.
            if (!this._inflacionOriginals) this._inflacionOriginals = {};
            // Se reserva un espacio específico para la fila actual basado en su ruta de binding.
            if (!this._inflacionOriginals[sPath]) this._inflacionOriginals[sPath] = {};

            const oOriginals = this._inflacionOriginals[sPath];

            // Se itera sobre todas las propiedades del objeto de la fila.
            Object.keys(oRow).forEach(function (sKey) {
                // Se utiliza una expresión regular para actuar solo sobre los campos de datos temporales (Y2025 o M2025_01).
                if (/^y\d{4}$/.test(sKey) || /^m\d{4}_\d+$/.test(sKey)) {
                    // Se parsea el valor original almacenado en el modelo.
                    const fOriginal = parseFloat(oRow[sKey]) || 0;

                    // Si el valor base es cero, se ignora el cálculo (cero por inflación sigue siendo cero).
                    if (fOriginal === 0) return;

                    // Si es la primera vez que se altera este campo, se guarda su valor puro en el respaldo.
                    if (oOriginals[sKey] === undefined) {
                        oOriginals[sKey] = oRow[sKey];
                    }

                    // Se aplica el cálculo de incremento porcentual: Valor * (1 + (Porcentaje / 100)).
                    const fCalculated = fOriginal * (1 + fInflacion / 100);
                    // Se sobrescribe la propiedad en el modelo forzando un formato de dos decimales.
                    oModel.setProperty(sPath + "/" + sKey, fCalculated.toFixed(2));
                }
            });
        },

        /**
         * Se restituyen los montos que existían antes de aplicar cualquier incremento porcentual por inflación.
         * Devuelve la fila a sus valores netos base.
         */
        _restoreInflacionRow: function (sPath, skipDelete) {
            // Se verifica que exista un respaldo previo para esta fila.
            if (!this._inflacionOriginals || !this._inflacionOriginals[sPath]) return;

            const oModel = this.getView().getModel();
            const oOriginals = this._inflacionOriginals[sPath];

            // Se recorren las propiedades respaldadas y se reinyectan al modelo.
            Object.keys(oOriginals).forEach(function (sKey) {
                oModel.setProperty(sPath + "/" + sKey, oOriginals[sKey]);
            });

            // Si no se solicita lo contrario mediante la bandera, se purga la memoria del respaldo para esta fila.
            if (!skipDelete) {
                delete this._inflacionOriginals[sPath];
            }
        },

        /**
         * Se recupera la ubicación jerárquica (ruta de binding) de un nodo específico dentro del árbol.
         */
        _findPathByNode: function (oTargetNode, aCategories, sBasePath) {
            // Se define el punto de partida de la búsqueda si no fue proporcionado en la recursión.
            const basePath = sBasePath || "/catalog/models/categories";

            for (let i = 0; i < aCategories.length; i++) {
                // Se construye la ruta teórica de la iteración actual.
                const sPath = basePath + "/" + i;

                // Si el objeto actual coincide por referencia con el nodo buscado, se devuelve la ruta.
                if (aCategories[i] === oTargetNode) return sPath;

                // Si el objeto posee hijos, se invoca la búsqueda recursiva descendiendo un nivel en la jerarquía.
                if (Array.isArray(aCategories[i].categories)) {
                    const sFound = this._findPathByNode(
                        oTargetNode,
                        aCategories[i].categories,
                        sPath + "/categories"
                    );
                    if (sFound) return sFound;
                }
            }
            // Si el nodo no se encuentra en toda la estructura, se devuelve nulo.
            return null;
        },

        /**
         * Se confirma la persistencia de las modificaciones, volcando el estado actual al snapshot de respaldo (SavedData).
         */
        onSave: function () {
            const oModel = this.getView().getModel();
            const oUiModel = this.getView().getModel("ui");
            const oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!oModel) return;

            // Se lanza un diálogo nativo de SAPUI5 pidiendo confirmación al usuario antes de sobrescribir.
            MessageBox.confirm(
                oBundle.getText("saveConfirmMessage"),
                {
                    title: oBundle.getText("saveConfirmTitle"),
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: sap.m.MessageBox.Action.OK,
                    onClose: function (oAction) {
                        // Si el usuario acepta, se toma una nueva foto del modelo (snapshot).
                        if (oAction === MessageBox.Action.OK) {
                            this._savedData = JSON.parse(JSON.stringify(oModel.getData()));
                            // Se apaga el modo edición de la interfaz.
                            oUiModel.setProperty("/isEditMode", false);
                            MessageToast.show(oBundle.getText("saveSuccess"));
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Se interrumpe la edición y se restauran los valores por defecto o el último estado guardado.
         */
        onCancelPress: function () {
            const oUiModel = this.getView().getModel("ui");
            const oModel = this.getView().getModel();
            const oBundle = this.getView().getModel("i18n").getResourceBundle();
            const oCurrentData = oModel.getData();

            // Se determina qué versión de los datos servirá como ancla de restauración (la guardada manualmente o la inicial).
            let oReferenceData = this._savedData || this._initialData;
            let bHasChanges = false;

            // Si es la primera vez y no hay referencia, se toma como estado inicial el actual.
            if (!oReferenceData) {
                this._initialData = JSON.parse(JSON.stringify(oCurrentData));
                oReferenceData = this._initialData;
                bHasChanges = true;
            } else {
                // Se comparan las cadenas JSON para determinar si ha habido alguna alteración en la tabla.
                bHasChanges = JSON.stringify(oCurrentData) !== JSON.stringify(oReferenceData);
            }

            // Si los datos son idénticos al respaldo, se informa al usuario y se interrumpe la ejecución.
            if (!bHasChanges) {
                MessageToast.show(oBundle.getText("noChangesToCancel"));
                return;
            }

            // Se solicita confirmación para descartar los cambios volátiles.
            MessageBox.confirm(
                oBundle.getText("cancelConfirmMessage"),
                {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            // Si se confirma, se reinyecta el clon profundo del respaldo.
                            if (this._savedData) {
                                oModel.setData(JSON.parse(JSON.stringify(this._savedData)));
                            } else {
                                // Fallback: si no había datos salvados, se recarga del archivo local (o de la API según configuración).
                                oModel.loadData("model/Catalog.json");
                            }
                            // Se refresca agresivamente el modelo para obligar a la tabla a repintarse.
                            oModel.refresh(true);
                            oUiModel.setProperty("/isEditMode", false);
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Se inicializa el evento de filtrado para una fila concreta (generalmente desencadenado por un icono de embudo en la tabla).
         */
        filterTableRow: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext();

            if (!oContext) return;

            // Se deduce la ruta del listado completo de "hermanos" (el array que contiene el objeto actual).
            const sRowPath = oContext.getPath();
            const sSiblingsPath = sRowPath.substring(0, sRowPath.lastIndexOf("/"));
            this._sSiblingsPath = sSiblingsPath;

            const oModel = this.getView().getModel();
            const aSiblings = oModel.getProperty(sSiblingsPath);

            if (!Array.isArray(aSiblings)) return;

            // Se genera un backup parcial exclusivo para este nivel del árbol, pero solo si se cambió de nivel de búsqueda.
            if (this._lastSiblingsPath !== sSiblingsPath) {
                this._aOriginalSiblings = JSON.parse(JSON.stringify(aSiblings));
                this._lastSiblingsPath = sSiblingsPath;
                this._aActiveFilters = {};
            }

            // Se establece sobre qué campo se realizará la búsqueda y se despliega el menú (Popover).
            this._sFilterProperty = oButton.data("filterProp") || "name";
            if (this._openFilterPopover) {
                this._openFilterPopover(oButton);
            }
        },

        /**
           * Se capturan los términos de búsqueda desde el Popover y se actualiza la tabla con los elementos "hermanos" que coincidan.
           */
        onSearchSibling: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || "";
            const oModel = this.getView().getModel();

            if (!this._sSiblingsPath || !this._aOriginalSiblings) return;
            if (!this._aActiveFilters) this._aActiveFilters = {};

            // Se añade o elimina el filtro activo según lo escrito por el usuario.
            if (sQuery) {
                this._aActiveFilters[this._sFilterProperty] = sQuery;
            } else {
                delete this._aActiveFilters[this._sFilterProperty];
            }

            const aFilterKeys = Object.keys(this._aActiveFilters);

            // Si el usuario vació todos los filtros de la caja, se restaura la vista de este nivel desde el backup parcial.
            if (aFilterKeys.length === 0) {
                oModel.setProperty(this._sSiblingsPath, this._aOriginalSiblings);
            } else {
                const aActiveFilters = this._aActiveFilters;

                // Se aplica el filtro múltiple iterando sobre el backup parcial.
                let aFiltered = this._aOriginalSiblings.filter(function (item) {
                    // Los objetos marcados como "cabecera" estructural nunca se ocultan.
                    if (item.cabecera === true) return true;
                    // Se verifica que el elemento cumpla con TODAS las condiciones de búsqueda activas.
                    return aFilterKeys.every(function (sProp) {
                        const sVal = item[sProp];
                        const sFilter = aActiveFilters[sProp];
                        return sVal && String(sVal).toLowerCase().includes(String(sFilter).toLowerCase());
                    });
                });

                // Se verifica si el filtrado dejó resultados reales (omitiendo cabeceras).
                const iRealResults = aFiltered.filter(function (item) {
                    return item.cabecera !== true;
                }).length;

                // Si no hay resultados reales, se purga la lista dejando solo la cabecera para indicar que la tabla está vacía en este nivel.
                if (iRealResults === 0) {
                    aFiltered = aFiltered.filter(function (item) {
                        return item.cabecera === true;
                    });
                }

                // Se aplican los resultados al modelo.
                oModel.setProperty(this._sSiblingsPath, aFiltered);
            }

            // Se cierra el menú flotante tras pulsar Enter/Buscar.
            if (this._pPopover) {
                this._pPopover.then(function (oPopover) {
                    oPopover.close();
                });
            }

            // Se fuerza el recálculo visual para ajustar cabeceras sticky y grupos tras modificar el DOM masivamente.
            setTimeout(function () {
                this._buildGroupRanges();
                this._applyCabeceraStyle();

                const oTable = this.getControlTable();
                if (oTable) {
                    this._onScrollLike({
                        getParameter: function (sName) {
                            if (sName === "firstVisibleRow") {
                                return oTable.getFirstVisibleRow();
                            }
                        }
                    });
                }
            }.bind(this), 50);
        },

        /**
         * Se procesa el clic del embudo de filtrado en la cabecera dinámica de la tabla.
         * Su lógica calcula a qué grupo pertenece la cabecera visible antes de lanzar el menú.
         */
        filterTableCabecera: function (oEvent) {
            oEvent.preventDefault();

            const oButton = oEvent.getSource();
            const oTable = this.getControlTable();
            const iFirstVisible = oTable.getFirstVisibleRow();

            if (!this._aGroupRanges || !this._aGroupRanges.length) return;

            // Se busca el grupo activo basado en la posición actual del scroll vertical.
            let oActiveGroup = null;
            for (let i = 0; i < this._aGroupRanges.length; i++) {
                const oGroup = this._aGroupRanges[i];
                if (iFirstVisible >= oGroup.start && iFirstVisible <= oGroup.end) {
                    oActiveGroup = oGroup;
                    break;
                }
            }

            if (!oActiveGroup) return;

            this._activeGroupStart = oActiveGroup.start;

            // Se asocia la ruta del hijo ("categories") del grupo activo para filtrar a nivel de subelementos.
            const sSiblingsPath = oActiveGroup.path + "/categories";
            this._sSiblingsPath = sSiblingsPath;

            const oModel = this.getView().getModel();
            const aSiblings = oModel.getProperty(sSiblingsPath);

            if (!Array.isArray(aSiblings)) return;

            if (this._lastSiblingsPath !== sSiblingsPath) {
                this._aOriginalSiblings = JSON.parse(JSON.stringify(aSiblings));
                this._lastSiblingsPath = sSiblingsPath;
                this._aActiveFilters = {};
            }

            this._sFilterProperty = oButton.data("filterProp") || "name";
            this._openFilterPopover(oButton);
        },

        /**
         * Se despliega el fragmento emergente (Popover) para introducir los parámetros de búsqueda.
         */
        _openFilterPopover: function (oButton) {
            const oView = this.getView();

            // Si el fragmento no existe en la vista, se carga de forma asíncrona.
            if (!this._pPopover) {
                this._pPopover = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "masterindirectos.fragments.PopoverFilter",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);

                    // Se vincula un evento para restaurar el valor tipeado anteriormente si se vuelve a abrir el popover.
                    oPopover.attachAfterClose(function () {
                        const oSearchField = sap.ui.core.Fragment.byId(oView.getId(), "searchField");
                        if (oSearchField) {
                            const sActive = (this._aActiveFilters && this._aActiveFilters[this._sFilterProperty]) || "";
                            oSearchField.setValue(sActive);
                        }
                    }.bind(this));

                    return oPopover;
                }.bind(this));
            }

            // Una vez garantizada la promesa, se procede con la apertura.
            this._pPopover.then(function (oPopover) {
                // Si el usuario vuelve a hacer clic, se cierra (comportamiento tipo toggle).
                if (oPopover.isOpen()) {
                    oPopover.close();
                    return;
                }

                // Se setea el texto que el usuario pudo haber buscado antes en esa misma columna.
                const oSearchField = sap.ui.core.Fragment.byId(oView.getId(), "searchField");
                if (oSearchField) {
                    const sActive = (this._aActiveFilters && this._aActiveFilters[this._sFilterProperty]) || "";
                    oSearchField.setValue(sActive);
                }
                oPopover.openBy(oButton);
            }.bind(this));
        },

        /**
         * Se establece la visibilidad de la cabecera dinámica secundaria (el "hijo" sticky) y se conmutan los filtros visuales.
         */
        _setStickyChild: function (bValue) {
            const oUiModel = this.getView().getModel("ui");
            oUiModel.setProperty("/showStickyChild", bValue);

            const oTable = this.getControlTable();
            if (!oTable) return;

            // Si el hijo flotante se activa, se aplican estilos a la tabla y se ocultan los embudos nativos de la cabecera real.
            if (bValue) {
                oTable.addStyleClass("stickyHeaderActive");

                // Se realiza una copia de seguridad de la propiedad de filtro de cada columna nativa y se limpia.
                oTable.getColumns().forEach(function (oCol) {
                    const sFilter = oCol.getFilterProperty();
                    if (sFilter) {
                        oCol.data("savedFilterProperty", sFilter);
                        oCol.setFilterProperty("");
                    }
                });

            } else {
                // Se retira la clase de activación.
                oTable.removeStyleClass("stickyHeaderActive");

                // Se restituyen los iconos de embudo en las columnas donde habían sido ocultados.
                oTable.getColumns().forEach(function (oCol) {
                    const sSaved = oCol.data("savedFilterProperty");
                    if (sSaved) {
                        oCol.setFilterProperty(sSaved);
                        oCol.data("savedFilterProperty", null);
                    }
                });
            }
        },

        /**
         * Se intercepta y procesa el evento de filtrado nativo proveniente de las cabeceras estándar del TreeTable.
         * Ejecuta una evaluación de todo el árbol en crudo para asegurar que si un hijo cumple el filtro, su padre no desaparezca.
         */
        onTreeTableFilter: function (oEvent) {
            // Se previene el comportamiento nativo de filtrado del control para aplicar la lógica personalizada.
            oEvent.preventDefault();

            // Se recoge el valor introducido por el usuario en el campo de filtro de la cabecera.
            const sValue = oEvent.getParameter("value") || "";
            // Se obtiene el modelo de datos principal de la tabla de corrientes.
            const oModel = this.getView().getModel("corrientesModel");
            // Se obtiene la instancia de la tabla jerárquica.
            const oTable = this.getControlTable();
            // Se obtiene el modelo de interfaz para gestionar la visibilidad de elementos flotantes.
            const oUiModel = this.getView().getModel("ui");

            // Se identifica la columna sobre la que se ha disparado el filtro.
            const oColumn = oEvent.getParameter("column");
            // Se extrae la propiedad de filtro de la columna o se usa "name" como valor de respaldo.
            const sFilterProperty = (oColumn && oColumn.getFilterProperty())
                ? oColumn.getFilterProperty()
                : "name";

            // Se inicializa el objeto de filtros activos si todavía no existe.
            if (!this._aTreeActiveFilters) {
                this._aTreeActiveFilters = {};
            }

            // Se registra o elimina el filtro activo según si el usuario ha escrito algo o ha borrado el campo.
            if (sValue) {
                this._aTreeActiveFilters[sFilterProperty] = sValue.toLowerCase();
                if (oColumn) oColumn.setFiltered(true);
            } else {
                delete this._aTreeActiveFilters[sFilterProperty];
                if (oColumn) oColumn.setFiltered(false);
            }

            // Se obtienen los datos actuales del modelo para generar el respaldo si aún no existe.
            const aCurrentData = oModel.getData();

            // Se determina si el modelo devuelve un array directo o un objeto envolvente.
            const aRootArray = Array.isArray(aCurrentData) ? aCurrentData : (aCurrentData.results || Object.values(aCurrentData)[0]);

            // Se genera el respaldo profundo del estado original de los datos únicamente la primera vez.
            if (!this._fullTreeBackup) {
                this._fullTreeBackup = JSON.parse(JSON.stringify(aRootArray));
            }

            // Se define la función auxiliar que resetea la visibilidad de columnas y cabeceras flotantes.
            const fnResetUI = function () {
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
                if (this.byId("colNew")) this.byId("colNew").setVisible(false);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(false);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(false);
                if (oUiModel) {
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
                this._setStickyChild(false);
            }.bind(this);

            // Se recogen las claves de todos los filtros activos en este momento.
            const aFilterKeys = Object.keys(this._aTreeActiveFilters);

            // CASO 1: El usuario ha vaciado todos los filtros activos.
            if (aFilterKeys.length === 0) {
                // Se restaura el array completo de datos desde el respaldo profundo.
                const aRestored = JSON.parse(JSON.stringify(this._fullTreeBackup));
                // Se reinyectan los datos originales al modelo de forma compatible con la estructura raíz.
                if (Array.isArray(aCurrentData)) {
                    oModel.setData(aRestored);
                } else {
                    const sRootKey = Object.keys(aCurrentData)[0];
                    const oRestored = {};
                    oRestored[sRootKey] = aRestored;
                    oModel.setData(oRestored);
                }
                fnResetUI();
                // Se colapsa la tabla y se recalculan los rangos y estilos visuales.
                oTable.collapseAll();
                this._buildGroupRanges();
                this._applyCabeceraStyle();
                return;
            }

            const aActiveFilters = this._aTreeActiveFilters;

            // Se define la función que evalúa si un nodo satisface todos los criterios de filtrado activos.
            const fnMatchesAll = function (oNode) {
                return aFilterKeys.every(function (sProp) {
                    return oNode[sProp] != null &&
                        String(oNode[sProp]).toLowerCase().includes(aActiveFilters[sProp]);
                });
            };

            const aFiltered = [];
            let bCasoHijo = false;
            let bDetalleExpanded = false;

            // CASO 2: Hay filtros activos. Se recorre el árbol desde el nivel superior.
            this._fullTreeBackup.forEach(function (oPadre) {

                // Se descarta el nodo si no es un nodo real con estructura jerárquica.
                const bEsNodoReal = oPadre.isGroup === true ||
                    (Array.isArray(oPadre.children) && oPadre.children.length > 0);

                if (!bEsNodoReal) { return; }

                // Sub-Caso A: El propio nodo padre satisface los criterios de búsqueda.
                if (fnMatchesAll(oPadre)) {
                    aFiltered.push(JSON.parse(JSON.stringify(oPadre)));
                    return;
                }

                // Sub-Caso B: Se busca en los nodos hijos directos del padre.
                const aHijosMatchados = [];
                if (Array.isArray(oPadre.children)) {
                    oPadre.children.forEach(function (oHijo) {
                        // Se verifica si el hijo cumple los criterios de filtrado.
                        if (fnMatchesAll(oHijo)) {
                            aHijosMatchados.push(JSON.parse(JSON.stringify(oHijo)));

                            // Se comprueba si el hijo tiene subniveles de detalle expandibles.
                            if (Array.isArray(oHijo.children) &&
                                oHijo.children.length > 0 &&
                                oHijo.children[0].isGroup === true) {
                                bDetalleExpanded = true;
                            }
                        }
                    });
                }

                // Si se encontraron hijos coincidentes, se construye una copia del padre con solo esos hijos.
                if (aHijosMatchados.length > 0) {
                    const oPadreCopia = JSON.parse(JSON.stringify(oPadre));
                    oPadreCopia.children = aHijosMatchados;
                    aFiltered.push(oPadreCopia);
                    bCasoHijo = true;
                }
            });

            // Se blanquea la interfaz y se inyectan los datos filtrados al modelo.
            fnResetUI();

            // Se aplican los datos filtrados al modelo respetando la estructura raíz original.
            if (Array.isArray(aCurrentData)) {
                oModel.setData(aFiltered);
            } else {
                const sRootKey = Object.keys(aCurrentData)[0];
                const oFiltered = {};
                oFiltered[sRootKey] = aFiltered;
                oModel.setData(oFiltered);
            }

            const oBinding = oTable.getBinding("rows");
            if (!oBinding) { return; }

            // Se ajusta la expansión de la tabla según el tipo de resultado obtenido.
            if (bCasoHijo) {
                // Se expande hasta el segundo nivel para mostrar los hijos coincidentes.
                oTable.expandToLevel(2);
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(bDetalleExpanded);
                if (this.byId("colNew")) this.byId("colNew").setVisible(bDetalleExpanded);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(bDetalleExpanded);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(bDetalleExpanded);
            } else {
                // Si solo se encontraron padres, se colapsa y se expande solo el primer nivel.
                oTable.collapseAll();
                oTable.expandToLevel(1);
            }

            // Se recalculan los rangos de grupos y los estilos de cabecera.
            this._buildGroupRanges();
            this._applyCabeceraStyle();
        },

        /**
         * Se formatea numéricamente una cadena de texto, dotándola de la cantidad exacta de decimales y del separador regional.
         */
        formatDecimales: function (numStr, decStr, decimalSep, groupSep) {
            // Se transforma la cadena a un valor flotante matemático que JavaScript pueda entender.
            const num = parseFloat(numStr.replace(decimalSep, "."));
            const dec = parseInt(decStr, 10);

            // Si las conversiones fallan, se retorna una cadena vacía previniendo renderizados de 'NaN' en la tabla.
            if (isNaN(num) || isNaN(dec)) {
                return "";
            }

            // Se instancia un formateador de SAPUI5 configurado en base a los parámetros proporcionados.
            const oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
                minFractionDigits: dec,
                maxFractionDigits: dec,
                decimalSeparator: decimalSep,
                groupingSeparator: groupSep || "",
                groupingEnabled: !!groupSep
            });

            // Retorna la cadena ya adaptada visualmente a los requerimientos.
            return oNumberFormat.format(num);
        },

        /**
         * Se controla el estado de visibilidad de la columna de ajustes actualizando
         * el modelo de visibilidad con el valor booleano recibido directamente del evento.
         * Se marca ademas la variante activa como modificada para habilitar el guardado directo.
         */
        onAjustesCheckBox: function (oEvent) {
            var bSelected = oEvent.getParameter("selected");
            this.getView().getModel("visibleColumn").setProperty("/visible", bSelected);
            this._markVariantDirty();
        },

    });
});