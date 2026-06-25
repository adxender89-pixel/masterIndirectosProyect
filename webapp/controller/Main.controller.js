sap.ui.define(
  [
    "zindirect_costs/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/m/MessagePopover",
    "sap/m/MessageItem",
    "sap/m/Button"
  ],
  function (BaseController, JSONModel, MessageToast, MessageBox, Fragment, MessagePopover, MessageItem, Button) {
    "use strict";

    return BaseController.extend("zindirect_costs.controller.Main", {

      /**
       * Se inicializa el controlador principal de la aplicación.
       * Se encarga de instanciar los modelos globales de alcance, tramos y estado de la interfaz.
       */
      onInit: function () {
        var _this = this;

        this.setInitData();

        // Se inicializa el modelo de mensajes vacío
        this.getView().setModel(new JSONModel([]), "messageModel");

        // Se instancia el MessagePopover con botón de limpieza en la cabecera
        this.oMessagePopover = new MessagePopover({
          headerButton: new Button({
            text: this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("LIMPIAR_MENSAJES")
          }).attachPress(function () {
            _this.getView().getModel("messageModel").setData([]);
          }),
          items: {
            path: "messageModel>/",
            template: new MessageItem({
              type: "{messageModel>type}",
              title: "{messageModel>title}",
              activeTitle: "{messageModel>active}",
              description: "{messageModel>description}",
              subtitle: "{messageModel>subtitle}",
              counter: "{messageModel>counter}"
            })
          }
        }).addStyleClass("messageView");

        this.getView().addDependent(this.oMessagePopover);
      },
      /**
       * Se abre o cierra el MessagePopover anclado al botón del footer.
       */
      onMessagePopoverPress: function (oEvent) {
        this.oMessagePopover.toggle(oEvent.getSource());
      },

      /**
       * Se añaden mensajes al MessagePopover.
       * @param {Array} messages - Array de objetos con Tipo (S/W/E) y Mensaje.
       * @param {boolean} forceOpen - Si es true, abre el popover aunque no haya errores.
       */
      showMessageInMessageView: function (messages, forceOpen) {
        var _this = this;
        var messageModelData = _this.getView().getModel("messageModel").getData();
        var date = new Date();
        date = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "hh:mm:ss" }).format(date);
        var error = false;
        for (var i in messages) {
          var mensaje = messages[i];
          var item = {
            type: mensaje.Tipo === "S" ? "Success" : mensaje.Tipo === "W" ? "Warning" : "Error",
            title: mensaje.Mensaje + " " + date
          };
          messageModelData.unshift(item);
          if (mensaje.Tipo === "E") {
            error = true;
          }
        }
        if (error || forceOpen) {
          var oBtn = _this.byId("messageViewBtn");
          if (oBtn && !_this.oMessagePopover.isOpen()) {
            _this.oMessagePopover.openBy(oBtn);
          }
        }
        _this.getView().getModel("messageModel").refresh();
      },

      setInitData: async function () {
        const oVisibleColumn = new sap.ui.model.json.JSONModel({
          visible: false,
        });
        this.getView().setModel(oVisibleColumn, "visibleColumn");

        this._bNodeExpanded = false;

        // Se inicializa el modelo UI para controlar la visibilidad de cabeceras fijas y datos sticky.
        this.getView().setModel(
          new sap.ui.model.json.JSONModel({
            showStickyAgrupador: false,
            showStickyParent: false,
            showStickyChild: false,
            stickyHeaderData: {
              parent: {
                name: "",
                currency: "",
                amount: "",
                pricepending: "",
                pricetotal: "",
                size: "",
                last: "",
                months: "",
                pend: "",
                flag1: false,
                flag2: false
              },
              child: {
                name: "",
                currency: "",
                amount: "",
                pricepending: "",
                pricetotal: "",
                size: "",
                last: "",
                months: "",
                pend: "",
                flag1: false,
                flag2: false
              }
            },
            operacionesCombo: [],
            isEditMode: false,
            dynamicRowCount: 10,
            //   Se mantiene la clave de la pestaña activa para condicionar la visibilidad del botón "Catálogo de recursos" del sidebar
            activeTab: "dashboard"
          }),
          "ui"
        );
        this.getView().getModel("ui").setProperty("/isEditMode", true);

        // Se crea el modelo para los indicadores numéricos superiores.
        const oDataTitleModel = new sap.ui.model.json.JSONModel({
          data: [
            {
              title: "112.083,28",
              title2: "0,00",
              title3: "106.212,51",
              title4: "5.870,77",
            },
          ],
        });
        this.getView().setModel(oDataTitleModel, "dataTitle");

        // Se carga el modelo de datos principal desde el JSON externo.
        const oDataModel = new sap.ui.model.json.JSONModel("model/models.json");
        this.getView().setModel(oDataModel, "data");
        this._mViews = {};

        // Se inicia la configuración básica de la aplicación cargando los datos del usuario, los tramos y el acceso.
        const userConfig = await this.getUserConfig();
        const userInsite = await this.getUserInsite(userConfig);

        const userData = {
          ...userInsite.userData,
          ...userConfig
        };
        // Se preserva userParameters original para usarlo como base en el guardado de configuración,
        // ya que contiene referencias a entidades Hibernate (tgentimezone, etc.) que son obligatorias.
        const oOriginalUserParameters = userData.userParameters || {};
        delete userData.userParameters;

        const appDataModel = new JSONModel({
          userData: userData,
          userParameters: oOriginalUserParameters,
          tramo: null
        });
        this.setGlobalModel(appDataModel, "appData");

        const tramo = await this.getTramos(userData);
        delete tramo.__metadata;
        appDataModel.setProperty("/tramo", tramo);

        this._lastSelectedKey = "dashboard";
        this._showView("dashboard");

        //     Se inicializa el modelo historyModel que alimenta el
        //   panel "Histórico de modificaciones". El backend ZIND_LOG todavia
        //   no esta disponible: el array results queda vacio y la tabla
        //   mostrara el mensaje noDataText (HISTORY_SIN_RESULTADOS) hasta
        //   que se conecte la llamada al servicio.
        this._initHistoryModel();
        //     
      },

      //     Se inicializa el JSONModel del panel de historial. La
      //   estructura "filters" contiene los tres filtros editables desde el
      //   fragment (operacion + Desde + Hasta) y los respectivos valueState/
      //   valueStateText usados para senalizar rango invalido. El panel ya
      //   no muestra la tabla de resultados: cuando exista el backend
      //   ZIND_LOG, el listado se entregara directamente al usuario via
      //   descarga Excel desde onHistoryExportarExcel.
      _initHistoryModel: function () {
        var oHistoryModel = new JSONModel({
          filters: {
            operacion: "",
            desde: null,
            hasta: null,
            desdeState: "None",
            desdeStateText: "",
            hastaState: "None",
            hastaStateText: ""
          }
        });
        this.getView().setModel(oHistoryModel, "historyModel");
      },
      //     

      /**
       * Se obtiene la configuración del usuario desde el backend.
       */
      getUserConfig: async function () {
        return this.post(this.getGlobalModel("mainService"), "/ConfigLoadSet", {
          NavEscenario1: [],
          NavEscenario2: [],
          NavEscenario3: [],
          NavLoadAmount: [],
          NavLoadDate: [],
          NavLoadLang: [],
          NavLoadUserConfig: []
        }).then(function (response) {
          // Se inicializa el modelo de configuración de usuario con las listas de opciones
          // que se usarán para nutrir los Select de la pantalla de configuración.
          const oUserConfigOptionsModel = new sap.ui.model.json.JSONModel({
            languages: (response.NavLoadLang && response.NavLoadLang.results) || [],
            dateFormats: (response.NavLoadDate && response.NavLoadDate.results) || [],
            amountFormats: (response.NavLoadAmount && response.NavLoadAmount.results) || []
          });
          this.setGlobalModel(oUserConfigOptionsModel, "userConfigOptionsModel");

          if (response.NavLoadUserConfig.results.length > 0) {
            return response.NavLoadUserConfig.results[0];
          }
        }.bind(this));
      },

      /**
       * Se procesa el inicio de sesión del usuario en el sistema Insite.
       */
      getUserInsite: async function (user) {
        const sUrl = this.getEndpointData().urlInsite;
        return this.callExternalService(sUrl + "/security/userLogin", "GET", {
          loginUser: user.User,
          idLanguage: user.AplicationLangu
        });
      },

      /**
       * Se obtienen los tramos disponibles para el usuario actual.
       */
     getTramos: async function (userData) {
        return new Promise((resolve, reject) => {
          this.getTramosByObra(userData.initialNode).then((response) => {
            const oDatosTramos = response.NavTramosDatos.results[0];

            if (!oDatosTramos.Error) {
              if(!this.getGlobalModel("normModel")){
                const norm = oDatosTramos.Norma;
                const normModel = new JSONModel({
                  norma: norm
                });
                this.setGlobalModel(normModel, "normModel");
              }
              else{
                this.getGlobalModel("normModel").setProperty("/norma",norm)
              }
              if (response.NavTramosProy.results.length > 1) {
                this.openSelectorDialog({
                  title: this.getTranslatedText("SELECCIONA_TRAMO"),
                  columns: [
                    { label: this.getTranslatedText("TRAMO"), property: "ProyectoExt" },
                    { label: this.getTranslatedText("DESCRIPCION"), property: "Descripcion" }
                  ],
                  onAccept: function (selectedItems) {
                    resolve(selectedItems[0]);
                  }
                }, response.NavTramosProy.results);
              } else {
                resolve(response.NavTramosProy.results[0]);
              }
            } else {
              this.createMessageDialog({
                title: this.getTranslatedText("ERROR"),
                textAccept: this.getTranslatedText("ACEPTAR"),
                messages: [{
                  text: oDatosTramos.Error,
                  type: "Error",
                  showIcon: false,
                  onAccept: function () { },
                }]
              });
            }
          }).catch(err => {
            reject(err);
          });
        });
      },

      /**
       * Se alterna la visibilidad de la barra lateral de acciones.
       */
      onToggleSideBar: function () {
        const oSideBar = this.byId("sideActionToolbar");
        //    al ocultar la barra lateral de acciones se cierran tambien todos los paneles laterales derechos (catalogo de recursos, historial, fichero, hipervinculo) porque dependen visualmente del propio sideActionToolbar (sus iconos viven en esa barra); si el toolbar desaparece y el panel sigue visible queda flotando huerfano sin manera de cerrarlo desde el icono original. Se reutiliza _hideOtherSidePanels(null) para que el comparador sId !== sKeepId acierte siempre y se oculten los cuatro paneles sin necesidad de iterar de nuevo la lista  
        const bNewVisible = !oSideBar.getVisible();
        oSideBar.setVisible(bNewVisible);
        if (!bNewVisible) {
          this._hideOtherSidePanels(null);
        }
      },

      //     Se alterna la visibilidad del panel lateral de historial
      //   asociado al icono de reloj de la cabecera. Se replica el mismo
      //   patron simple de onToggleSideBar. Al abrir se sincroniza maxDate
      //   de los DateTimePicker con la hora actual para que el usuario no
      //   pueda seleccionar fechas futuras (regla de negocio del usuario).
      onToggleHistorySidebar: function () {
        const oHistoryBar = this.byId("historySideBar");
        if (!oHistoryBar) return;
        const bNuevaVis = !oHistoryBar.getVisible();
        if (bNuevaVis) {
          this._hideOtherSidePanels("historySideBar");
        }
        oHistoryBar.setVisible(bNuevaVis);
        if (bNuevaVis) {
          this._refreshHistoryMaxDate();
          //   Se asegura la presencia del icono X (borrado) dentro de cada DateTimePicker la primera vez que se abre el panel. La version UI5 1.71 no soporta showClearIcon nativo, por lo que se emula via insertEndIcon con visibilidad ligada al valor del filtro en historyModel, replicando el comportamiento del SearchField de Operacion (icono visible solo cuando hay contenido y al pulsarlo se limpia el campo + el modelo).  
          this._ensureHistoryClearIcons();
          //  
        }
      },

      //   Helper que instala una sola vez el icono X interno en los DateTimePicker desde/hasta del panel historial. Marca el flag _bHistoryClearIconsReady para evitar agregar el icono mas de una vez. La visibilidad se enlaza a historyModel>/filters/desde|hasta via expression binding, de modo que el icono aparece y desaparece automaticamente segun el valor del modelo, igual que la X nativa del SearchField. Al pulsar, se limpia el value del control y la property correspondiente del modelo.  
      _ensureHistoryClearIcons: function () {
        if (this._bHistoryClearIconsReady) return;
        var that = this;
        var aSpecs = [
          { picker: this.byId("historyDesdePicker"), prop: "/filters/desde" },
          { picker: this.byId("historyHastaPicker"), prop: "/filters/hasta" }
        ];
        aSpecs.forEach(function (oSpec) {
          var oPicker = oSpec.picker;
          if (!oPicker || typeof oPicker.addEndIcon !== "function") return;
          var oIcon = oPicker.addEndIcon({
            src: "sap-icon://decline",
            noTabStop: true,
            tooltip: "{i18n>HISTORY_LIMPIAR}",
            press: function () {
              oPicker.setValue("");
              var oModel = that.getView().getModel("historyModel");
              if (oModel) {
                oModel.setProperty(oSpec.prop, null);
              }
              if (typeof that._validateHistoryRange === "function") {
                that._validateHistoryRange();
              }
            }
          });
          oIcon.bindProperty("visible", {
            path: "historyModel>" + oSpec.prop,
            formatter: function (vVal) { return !!vVal; }
          });
          //   Se aplica la clase historyClearIcon al icono X para que el CSS lo coloque ANTES del icono calendar via flex order, lo reduzca de tamanyo y le anyada un pequeno gap a la derecha.  
          if (typeof oIcon.addStyleClass === "function") {
            oIcon.addStyleClass("historyClearIcon");
          }
          //  
        });
        this._bHistoryClearIconsReady = true;
      },
      //  

      //   Se actualiza min/maxDate de ambos DateTimePicker. Reglas:
      //   - minDate = 1 de enero del anyo de appData.Freal (limite inferior
      //     del rango de ejercicios del Select de anyos).
      //   - maxDate = ultimo segundo del anyo de appData.Frealfinobra, pero
      //     clampado a la fecha actual: no se permiten fechas futuras aunque
      //     el horizonte del tramo se extienda mas alla (regla confirmada
      //     por el usuario). Si por algun motivo Freal/Frealfinobra no estan
      //     disponibles se aplica solo el clamp por now() para mantener al
      //     menos la proteccion contra futuro.
      _refreshHistoryMaxDate: function () {
        var oNow = new Date();
        var oAppDataModel = this.getGlobalModel && this.getGlobalModel("appData");
        var oAppData = oAppDataModel ? oAppDataModel.getData() : {};
        var sFreal = oAppData.Freal;
        var sFrealfin = oAppData.Frealfinobra;
        var oDateFreal = sFreal ? this._parseODataDate(sFreal) : null;
        var oDateFin = sFrealfin ? this._parseODataDate(sFrealfin) : null;
        var oMin = null;
        var oMax = oNow;
        if (oDateFreal && !isNaN(oDateFreal.getTime())) {
          oMin = new Date(oDateFreal.getFullYear(), 0, 1, 0, 0, 0);
        }
        if (oDateFin && !isNaN(oDateFin.getTime())) {
          var oFinYearEnd = new Date(oDateFin.getFullYear(), 11, 31, 23, 59, 59);
          //   Se clampa al actual: si Frealfinobra cae en el futuro el
          //   maxDate sigue siendo "ahora" para impedir seleccionar dias
          //   o horas posteriores al instante presente.
          oMax = oFinYearEnd.getTime() < oNow.getTime() ? oFinYearEnd : oNow;
        }
        var oDesde = this.byId("historyDesdePicker");
        var oHasta = this.byId("historyHastaPicker");
        if (oDesde) {
          if (oMin && oDesde.setMinDate) oDesde.setMinDate(oMin);
          if (oDesde.setMaxDate) oDesde.setMaxDate(oMax);
        }
        if (oHasta) {
          if (oMin && oHasta.setMinDate) oHasta.setMinDate(oMin);
          if (oHasta.setMaxDate) oHasta.setMaxDate(oMax);
        }
      },

      //   Handler suggest del SearchField "Operacion": construye sugerencias
      //   a partir de las operaciones (PhPspnr) presentes en la vista activa.
      //   Replica el patron de BaseController.onOperacionSuggest: la primera
      //   vez se crea un JSONModel "opSugg" y se ata via bindAggregation a
      //   suggestionItems; en llamadas posteriores solo se actualiza el array
      //   "items" del modelo. Esto evita destruir y recrear los SuggestionItem
      //   en cada keystroke (lo cual hacia perder el click del usuario, ya
      //   que el item bajo el puntero era destruido antes de registrar el
      //   evento de seleccion).
      onHistoryOperacionSuggest: function (oEvent) {
        var oSearchField = oEvent.getSource();
        var sTerm = (oEvent.getParameter("suggestValue") || "").toLowerCase();
        var aOperaciones = this._collectActiveOperaciones();
        var aFiltradas = sTerm
          ? aOperaciones.filter(function (sOp) {
              return sOp.toLowerCase().indexOf(sTerm) >= 0;
            })
          : aOperaciones;
        var aItems = aFiltradas.slice(0, 100).map(function (sOp) {
          return { code: sOp };
        });

        //   Se inicializa una sola vez el modelo y el binding de suggestionItems.
        //   En las siguientes llamadas solo se actualiza /items con setProperty,
        //   conservando las mismas instancias de SuggestionItem (no hay destroy).
        var oSuggestModel = oSearchField.getModel("opSugg");
        if (!oSuggestModel) {
          oSuggestModel = new JSONModel({ items: aItems });
          oSuggestModel.setSizeLimit(1000);
          oSearchField.setModel(oSuggestModel, "opSugg");
          oSearchField.bindAggregation("suggestionItems", {
            path: "opSugg>/items",
            template: new sap.m.SuggestionItem({
              text: "{opSugg>code}"
            }),
            templateShareable: false
          });
        } else {
          oSuggestModel.setProperty("/items", aItems);
        }

        //   Se fuerza el despliegue del popup de sugerencias por si la fuente
        //   inicial estaba vacia y el control no lo abria automaticamente.
        oSearchField.suggest();
      },

      //   Handler liveChange: punto de extension futuro (debounce + buscar
      //   automatico cuando el backend este disponible). Por ahora vacio.
      onHistoryOperacionLiveChange: function () {
        //   intencionalmente vacio
      },

      //   Handlers change de los DateTimePicker Desde/Hasta: centralizan la
      //   validacion en _validateHistoryRange para evitar ramas duplicadas.
      onHistoryDesdeChange: function () {
        this._validateHistoryRange();
      },
      onHistoryHastaChange: function () {
        this._validateHistoryRange();
      },

      //   Helper que evalua la coherencia del rango Desde/Hasta y actualiza
      //   los valueState de ambos DateTimePicker. Devuelve true si el rango
      //   es valido (o esta incompleto) y false si Hasta < Desde.
      _validateHistoryRange: function () {
        var oModel = this.getView().getModel("historyModel");
        if (!oModel) return true;
        var oFilters = oModel.getProperty("/filters") || {};
        var oDesde = oFilters.desde ? new Date(oFilters.desde) : null;
        var oHasta = oFilters.hasta ? new Date(oFilters.hasta) : null;
        var bInvalido = oDesde && oHasta && oHasta.getTime() < oDesde.getTime();
        var sMsg = bInvalido ? this.getTranslatedText("HISTORY_RANGO_INVALIDO") : "";
        oModel.setProperty("/filters/desdeState", bInvalido ? "Error" : "None");
        oModel.setProperty("/filters/desdeStateText", sMsg);
        oModel.setProperty("/filters/hastaState", bInvalido ? "Error" : "None");
        oModel.setProperty("/filters/hastaStateText", sMsg);
        return !bInvalido;
      },

      //   Handler "Buscar": dispara la consulta al backend ZIND_LOG cuando
      //   este disponible. Por ahora se limita a validar el rango y mostrar
      //   un toast informativo. Importante: el SearchField fire este mismo
      //   evento "search" cuando el usuario clica una sugerencia, pero NO
      //   actualiza por si solo su propio value. Se intenta extraer el
      //   texto seleccionado en este orden:
      //   1. parametro suggestionItem (sap.m.SuggestionItem moderno)
      //   2. parametro selectedItem (compatibilidad con otras versiones)
      //   3. parametro query (la barra ya contiene el texto seleccionado)
      //   y se sincroniza tanto el modelo como el value del SearchField.
      onHistoryBuscar: function (oEvent) {
        if (oEvent && oEvent.getParameter) {
          var sText = "";
          var oSugg = oEvent.getParameter("suggestionItem") || oEvent.getParameter("selectedItem");
          if (oSugg && typeof oSugg.getText === "function") {
            sText = oSugg.getText();
          } else {
            sText = oEvent.getParameter("query") || "";
          }
          if (sText) {
            this.getView().getModel("historyModel")
              .setProperty("/filters/operacion", sText);
            var oSearchField = oEvent.getSource();
            if (oSearchField && oSearchField.setValue) {
              oSearchField.setValue(sText);
            }
          }
        }
        if (!this._validateHistoryRange()) return;
        MessageToast.show(this.getTranslatedText("HISTORY_PENDIENTE_BACKEND"));
      },

      //   Handler "Exportar Excel": placeholder hasta que el backend exponga
      //   el endpoint de exportacion (o se decida construir el XLSX en cliente).
      onHistoryExportarExcel: function () {
        MessageToast.show(this.getTranslatedText("HISTORY_PENDIENTE_BACKEND"));
      },


      //   Handler del boton X de la cabecera del panel: oculta el panel sin
      //   tocar los filtros, replicando el efecto del toggle desde la
      //   cabecera principal pero accesible desde dentro del propio panel.
      onHistoryClose: function () {
        var oHistoryBar = this.byId("historySideBar");
        if (oHistoryBar) oHistoryBar.setVisible(false);
      },


      //   Helper que recoge las operaciones (PhPspnr) del modelo de la vista
      //   activa para alimentar las sugerencias del filtro. Recorre el arbol
      //   buscando nodos con PhPspnr no vacio y devuelve una lista unica.
      //   Si no hay vista activa con un modelo de operaciones, devuelve [].
      _collectActiveOperaciones: function () {
        var sActiveTab = this.getView().getModel("ui").getProperty("/activeTab");
        var mTabToModel = {
          corrientes: "corrientesModel",
          anticipados: "anticipadosModel",
          diferidos: "diferidosModel",
          inmov: "inmovilizadosModel",
          externos: "externosModel"
        };
        var sModelName = mTabToModel[sActiveTab];
        if (!sModelName) return [];
        var oView = this._mViews && this._mViews[sActiveTab];
        if (!oView) return [];
        var oModel = oView.getModel(sModelName);
        if (!oModel) return [];
        var aSet = {};
        var fnWalk = function (oNode) {
          if (!oNode) return;
          if (Array.isArray(oNode)) {
            oNode.forEach(fnWalk);
            return;
          }
          if (oNode.PhPspnr) aSet[oNode.PhPspnr] = true;
          if (Array.isArray(oNode.children)) fnWalk(oNode.children);
        };
        fnWalk(oModel.getData());
        return Object.keys(aSet).sort();
      },
      //     

     
      onShowShortcuts: async function (oEvent) {
        //   Se cachea el fragment para no recrearlo en cada apertura
        if (!this._oShortcutsPopover) {
          this._oShortcutsPopover = await Fragment.load({
            id: this.getView().getId(),
            name: "zindirect_costs.fragments.ShortcutsDialog",
            controller: this
          });
          //   Se vincula al ciclo de vida de la vista para la limpieza automática
          this.getView().addDependent(this._oShortcutsPopover);
        }
        //   Se ancla el popover al botón pulsado en el sidebar
        this._oShortcutsPopover.openBy(oEvent.getSource());
      },

      /**
       *   Se invierte el estado de contabilización (campo BLOQZ) de los PEPs seleccionados.
       * Pendiente: integración con el servicio backend y el campo BLOQZ de ZPH_PP_PRESIND.
       */
      onToggleBloqueoContab: function () {
        MessageToast.show(this.getTranslatedText("workInPregress"));
      },

      /**
       *   Se lanza la importación masiva desde Excel (ver apartado 5.10 del spec).
       */
      onImportarExcel: function () {
        MessageToast.show(this.getTranslatedText("workInPregress"));
      },

      /**
       *   Se lanza la exportación a XLSX (ver apartado 5.9 del spec).
       *     Se abre un popover anclado al botón pulsado para que el usuario seleccione el tipo de exportación.
       */
      //   Se abre el popover selector del tipo de exportación en lugar de un MessageToast
      onExportarExcel: async function (oEvent) {
        //     Se cachea el fragment para no recrearlo en cada apertura
        if (!this._oExportPopover) {
          this._oExportPopover = await Fragment.load({
            id: this.getView().getId(),
            name: "zindirect_costs.fragments.ExportPopover",
            controller: this
          });
          this.getView().addDependent(this._oExportPopover);
        }
        //     Se ancla el popover al botón Exportar de la barra lateral
        this._oExportPopover.openBy(oEvent.getSource());
      },

      /**
       *     Se exporta la vista del capítulo actual (snapshot de sólo lectura, sin pestaña de obra/tramo).
       *   Se delega la generación al controlador del capítulo activo (Corrientes, Anticipados, ...).
       *   En el Dashboard la opción no es aplicable y se informa al usuario.
       */
      onExportarVistaCapitulo: function () {
        //     Se cierra el popover de selección antes de iniciar la exportación
        if (this._oExportPopover) {
          this._oExportPopover.close();
        }
        //     Se identifica la pestaña activa mediante el modelo "ui" gestionado por el Main
        const sActiveTab = this.getView().getModel("ui").getProperty("/activeTab");
        //     En el Dashboard la exportación de la vista de capítulo no aplica
        if (sActiveTab === "dashboard") {
          MessageToast.show(this.getTranslatedText("exportNotAvailableInDashboard"));
          return;
        }
        //     Se recupera la vista hija activa desde la caché interna _mViews del Main
        const oActiveView = this._mViews && this._mViews[sActiveTab];
        const oActiveController = oActiveView && oActiveView.getController();
        //     Si el capítulo activo todavía no implementa la exportación se muestra "workInPregress"
        if (!oActiveController || typeof oActiveController.exportarVistaCapitulo !== "function") {
          MessageToast.show(this.getTranslatedText("workInPregress"));
          return;
        }
        //     Se delega la generación del XLSX al controlador del capítulo
        oActiveController.exportarVistaCapitulo();
      },

      /**
       *     Se exporta la plantilla de carga de presupuestación y planificación (presind y planind).
       *   El archivo se compone de seis pestañas (Resumen + 5 capítulos: Anticipados, Inmovilizados,
       *   Corrientes, Diferidos, Externos). Antes de generar el XLSX se pregunta al usuario si quiere
       *   los 2 años visibles de la app o toda la obra (desde el mes actual hasta el fin, excluyendo
       *   los meses ya ejecutados — apartado 5.9 del spec).
       *   La orquestación (recolección de datos de cada capítulo + construcción de las 6 hojas) se
       *   delega en BaseController#exportarPlantillaCarga, que tiene acceso a _mViews para obtener
       *   los controllers ya inicializados de cada capítulo.
       */
      onExportarPlantillaCarga: function () {
        if (this._oExportPopover) {
          this._oExportPopover.close();
        }
        //     Se abre un Dialog personalizado en vez de MessageBox: los textos de los botones del spec
        //   ("Los 2 años visibles" / "Toda la obra (mes actual → fin)") no caben en los actions del
        //   MessageBox estándar y quedan truncados con elipsis. El Dialog permite controlar layout y ancho.
        this._openPlantillaCargaScopeDialog();
      },

      /**
       *     Construye y abre el Dialog selector de ámbito para la Plantilla de carga. Layout:
       *   título compacto, mensaje, dos botones grandes uno bajo otro con icono y texto descriptivo,
       *   más botón Cancelar al pie. El Dialog se cachea en this._oPlantillaScopeDialog para reutilizarlo.
       */
        _openPlantillaCargaScopeDialog: function () {
        const that = this;
        if (!this._oPlantillaScopeDialog) {
          const oTitle = new sap.m.Title({
            text: this.getTranslatedText("plantillaCargaScopeTitle"),
            level: "H4"
          });
          const oMessage = new sap.m.Text({
            text: this.getTranslatedText("plantillaCargaScopeText")
          }).addStyleClass("sapUiSmallMarginBottom");
          //     Botón "2 años": tipo Emphasized para destacarlo como acción recomendada. Sin icono
          //     para un look más minimalista (decisión de UI del usuario).
          const oBtnYears = new sap.m.Button({
            text: this.getTranslatedText("plantillaCargaScopeYears"),
            type: "Emphasized",
            width: "100%",
            press: function () {
              that._oPlantillaScopeDialog.close();
              that._runPlantillaCargaWithPreload("years");
            }
          }).addStyleClass("sapUiTinyMarginBottom");
          const oBtnAll = new sap.m.Button({
            text: this.getTranslatedText("plantillaCargaScopeAll"),
            type: "Default",
            width: "100%",
            press: function () {
              that._oPlantillaScopeDialog.close();
              that._runPlantillaCargaWithPreload("all");
            }
          });
          const oVBox = new sap.m.VBox({
            items: [oMessage, oBtnYears, oBtnAll]
          }).addStyleClass("sapUiSmallMargin");
          this._oPlantillaScopeDialog = new sap.m.Dialog({
            customHeader: new sap.m.Bar({ contentMiddle: [oTitle] }),
            contentWidth: "26rem",
            contentHeight: "auto",
            content: [oVBox],
            endButton: new sap.m.Button({
              text: this.getTranslatedText("ACEPTAR") ? this.getTranslatedText("CANCELAR") || "Cancelar" : "Cancelar",
              press: function () { that._oPlantillaScopeDialog.close(); }
            })
          });
          this.getView().addDependent(this._oPlantillaScopeDialog);
        }
        this._oPlantillaScopeDialog.open();
      },

      
      _runPlantillaCargaWithPreload: async function (sScope) {
        //   Precarga ligera + rápida: usamos creación off-DOM via _ensureChapterLoadedForExport
        //   (no mountamos/unmountamos views en tabContent, así evitamos el coste de DOM y los visibles
        //   "switches" entre tabs). Sólo se llaman los CambioPestIndirectosSet de los capítulos que NO
        //   tienen ya datos cargados. Tras generar el XLSX se DESTRUYEN las views creadas durante la
        //   precarga, así cuando el usuario clica una de esas pestañas, _showView crea una vista fresca
        //   y se evita el bug de columnas en orden incorrecto que aparecía al cliquear una view que
        //   se había instanciado off-DOM.
        //   Sobre "una sola llamada HTTP": el backend rechaza el $batch concurrente con varias
        //   operaciones a CambioPestIndirectosSet ("HTTP request failed") porque cada operación muta
        //   EvBloqueados. Se mantienen llamadas secuenciales, suprimiendo el diálogo "Cargando datos".
        const oPage = this.byId("page");
        const fnOriginalShowLoading = BaseController.prototype._showLoadingDialog;
        BaseController.prototype._showLoadingDialog = function () { /* noop durante precarga */ };
        if (oPage) {
          if (typeof oPage.setBusyIndicatorDelay === "function") {
            oPage.setBusyIndicatorDelay(0);
          }
          oPage.setBusy(true);
        }
        const aPrecargaCreatedKeys = []; //   views creadas durante esta precarga (a destruir al final)
        try {
          const aChapterKeys = ["anticipados", "inmov", "corrientes", "diferidos", "externos"];
          for (let i = 0; i < aChapterKeys.length; i++) {
            const sKey = aChapterKeys[i];
            //     Si ya tiene datos cargados, se salta (gran ganancia en flujos típicos: el usuario
            //   ha visitado al menos una pestaña antes de exportar).
            if (this._chapterHasLoadedData(sKey)) {
              continue;
            }
            const bExistedBefore = !!this._mViews[sKey];
            await this._ensureChapterLoadedForExport(sKey);
            //     Marca para destrucción posterior sólo si la view se creó AHORA (no si ya existía
            //   pero estaba vacía por otro motivo — preservar comportamiento de pestañas pre-existentes).
            if (!bExistedBefore && this._mViews[sKey]) {
              aPrecargaCreatedKeys.push(sKey);
            }
          }
          //     Una vez todos los capítulos cargados, se delega en BaseController para construir el workbook.
          this.exportarPlantillaCarga(sScope, this._mViews || {});
        } catch (oErr) {
          sap.m.MessageBox.error(
            this.getTranslatedText("exportErrorGeneric") + ": " + (oErr && oErr.message ? oErr.message : String(oErr))
          );
        } finally {
          //     Se destruyen las views creadas durante la precarga para que el siguiente _showView
          //   las recree limpias (sidestepea el bug del orden de columnas off-DOM).
          for (let i = 0; i < aPrecargaCreatedKeys.length; i++) {
            const sKey = aPrecargaCreatedKeys[i];
            const oView = this._mViews[sKey];
            if (oView) {
              try { oView.destroy(); } catch (e) { /* tolerancia: destrucción best-effort */ }
              delete this._mViews[sKey];
            }
          }
          BaseController.prototype._showLoadingDialog = fnOriginalShowLoading;
          if (oPage) oPage.setBusy(false);
        }
        
      },

      /**
       *     Devuelve true si el modelo de tabla del capítulo ya tiene datos cargados.
       *   Permite saltar la precarga de pestañas que el usuario ya ha visitado.
       */
      _chapterHasLoadedData: function (sKey) {
        const oView = this._mViews && this._mViews[sKey];
        if (!oView) return false;
        const oController = oView.getController();
        if (!oController || !oController.tableModelName) return false;
        const oModel = oView.getModel(oController.tableModelName);
        if (!oModel) return false;
        const aData = oModel.getProperty("/");
        return Array.isArray(aData) && aData.length > 0;
      },

      /**
       *     Se exporta el catálogo del capítulo de Corrientes.
       *   Pendiente: generación real del XLSX a partir del catálogo de recursos del capítulo.
       */
      onExportarCatalogoCapitulo: function () {
        if (this._oExportPopover) {
          this._oExportPopover.close();
        }
        MessageToast.show(this.getTranslatedText("workInPregress"));
      },
      //  

      /**
       *   Oculta el resto de paneles laterales derechos para que solo uno este
       *   visible a la vez (todos se anclan al mismo borde derecho y se solaparian).
       *   Recibe el id del panel que se quiere mantener abierto.
       */
      _hideOtherSidePanels: function (sKeepId) {
        ["historySideBar", "catalogoRecursosSideBar", "ficheroSideBar", "hipervinculoSideBar"].forEach(function (sId) {
          if (sId !== sKeepId) {
            var oPanel = this.byId(sId);
            if (oPanel) oPanel.setVisible(false);
          }
        }.bind(this));
      },

      /**
       *   Se abre la gestión de adjuntos a nivel de obra (visualizar/adjuntar fichero)
       *   como panel lateral derecho, replicando el patrón del catálogo de recursos.
       *   Segunda pulsación: toggle (se cierra). El contenido es placeholder por ahora.
       */
      onAdjuntarFichero: function () {
        var oSideBar = this.byId("ficheroSideBar");
        if (!oSideBar) return;
        if (oSideBar.getVisible()) {
          oSideBar.setVisible(false);
          return;
        }
        this._hideOtherSidePanels("ficheroSideBar");
        oSideBar.setVisible(true);
      },

      //     Handler del botón X del panel lateral de fichero: oculta el panel.
      onFicheroSideBarClose: function () {
        var oSideBar = this.byId("ficheroSideBar");
        if (oSideBar) oSideBar.setVisible(false);
      },

      /**
       *   Se abre la gestión de hipervínculos a nivel de obra (visualizar/adjuntar enlace)
       *   como panel lateral derecho, replicando el patrón del catálogo de recursos.
       *   Segunda pulsación: toggle (se cierra). El contenido es placeholder por ahora.
       */
      onAdjuntarHipervinculo: function () {
        var oSideBar = this.byId("hipervinculoSideBar");
        if (!oSideBar) return;
        if (oSideBar.getVisible()) {
          oSideBar.setVisible(false);
          return;
        }
        this._hideOtherSidePanels("hipervinculoSideBar");
        oSideBar.setVisible(true);
      },

      //     Handler del botón X del panel lateral de hipervínculo: oculta el panel.
      onHipervinculoSideBarClose: function () {
        var oSideBar = this.byId("hipervinculoSideBar");
        if (oSideBar) oSideBar.setVisible(false);
      },

       onAbrirCatalogoRecursos: async function () {
        try {
          //     Se bifurca el flujo en funcion del origen:
          //   - Si _sDescripVHRowPath esta fijado, la llamada viene del value-help
          //     del Input DESCRIP (gestionado en BaseController.onDescripInputValueHelpRequest)
          //     y se mantiene el Dialog modal historico, porque el flujo VH
          //     necesita resolver la seleccion antes de continuar la edicion de fila.
          //   - En caso contrario, la llamada viene del boton lateral derecho
          //     (icono employee del sideActionToolbar) y se abre el panel lateral
          //     (catalogoRecursosSideBar), igual que el Historico de modificaciones.
          //   Las dos rutas comparten el mismo modelo (catalogoRecursosModel) y el
          //   helper _loadCatalogoRecursos, por lo que el cuerpo de inicializacion
          //   del modelo es comun y solo cambia el contenedor que se hace visible.  
          var bOpenedFromVH = !!this._sDescripVHRowPath;

          //     Si el panel lateral ya esta abierto y la llamada NO viene
          //   del value-help, se interpreta como un toggle (segunda pulsacion del
          //   boton lateral) y se cierra el panel sin recargar nada. Asi el icono
          //   employee se comporta igual que el icono history en cabecera.  
          if (!bOpenedFromVH) {
            var oExistingSideBar = this.byId("catalogoRecursosSideBar");
            if (oExistingSideBar && oExistingSideBar.getVisible()) {
              oExistingSideBar.setVisible(false);
              return;
            }
          }
          //    

          if (bOpenedFromVH) {
            if (!this._oCatalogoRecursosDialog) {
              this._oCatalogoRecursosDialog = await Fragment.load({
                id: this.getView().getId(),
                name: "zindirect_costs.fragments.CatalogoRecursosDialog",
                controller: this
              });
              this.getView().addDependent(this._oCatalogoRecursosDialog);
            }
          }
          //    

          // Modelo inicial vacío para que los bindings de la tabla no se rompan al primer render.
          //   hasSelection controla el estado habilitado del botón "Añadir al desglose":
          //   solo se permite volcar un recurso cuando hay una fila seleccionada.
          //   El modelo se fija en la VISTA (no en el diálogo) para replicar el patrón del
          //   catálogo de operaciones (OperationsCatalogDialog), que sí pinta las filas: el
          //   diálogo es dependent de la vista y hereda sus modelos.
          //   visible = lista mostrada por la tabla (alterna entre obra/generales con el
          //   SegmentedButton); activeKey = pestaña lógica seleccionada.
          //   openedFromVH = true cuando el dialogo se abre desde el value-help del Input DESCRIP (en ese caso _sDescripVHRowPath se ha fijado antes en este controller por onDescripInputValueHelpRequest). Sirve para ocultar los botones Añadir/Editar/Borrar del popup en ese flujo: desde la descripcion solo se permite seleccionar y volcar al desglose, no gestionar el catalogo.
          //   Reutiliza el JSONModel existente (si lo hay) y solo refresca sus
          // datos: en la version anterior se llamaba setModel con un objeto
          // nuevo cada apertura, lo que dejaba los binding del dialogo ya
          // renderizado conectados al modelo viejo y openedFromVH no surtia efecto
          // en aperturas sucesivas.
          var oInitialData = {
            obra: [],
            generales: [],
            visible: [],
            activeKey: "obra",
            obraPrctr: "",
            hasSelection: false,
            openedFromVH: bOpenedFromVH,
            //    flag de carga perezosa de Generales; se reinicia en cada apertura del popup para forzar un fetch fresco cuando el usuario entre por primera vez en esa pestaña
            generalesLoaded: false
            //
          };
          var oCatalogoModel = this.getView().getModel("catalogoRecursosModel");
          if (!oCatalogoModel) {
            oCatalogoModel = new JSONModel(oInitialData);
            this.getView().setModel(oCatalogoModel, "catalogoRecursosModel");
          } else {
            oCatalogoModel.setData(oInitialData);
            //   Refresh defensivo: fuerza la reevaluacion de los binding del
            // dialogo ya renderizado (en particular el visible de los botones
            // Añadir/Editar/Borrar que depende de openedFromVH).
            oCatalogoModel.refresh(true);
          }
          //
          //     Se abre el contenedor adecuado: Dialog para el flujo VH
          //   y panel lateral para el flujo del boton lateral.  
          if (bOpenedFromVH) {
            this._oCatalogoRecursosDialog.open();
          } else {
            var oSideBar = this.byId("catalogoRecursosSideBar");
            if (oSideBar) {
              this._hideOtherSidePanels("catalogoRecursosSideBar");
              oSideBar.setVisible(true);
            }
          }
          //    

          await this._loadCatalogoRecursos();
        } catch (error) {
          console.error("[onAbrirCatalogoRecursos]", error);
          MessageBox.error(this.getTranslatedText("ERROR_AL_CARGAR") || "Error al cargar el catálogo de recursos");
        }
      },

      //     Handler del boton X del panel lateral del catalogo: oculta el
      //   panel sin alterar el modelo, replicando el patron de onHistoryClose. La
      //   limpieza de seleccion y de contexto VH la sigue gestionando
      //   onCloseCatalogoRecursosDialog cuando el flujo viene de "Anyadir al
      //   desglose", para no duplicar esa logica.  
      onCatalogoRecursosSideBarClose: function () {
        var oSideBar = this.byId("catalogoRecursosSideBar");
        if (oSideBar) oSideBar.setVisible(false);
      },
      //    

      //     Devuelve la tabla del catalogo activa en cada momento:
      //   - si el side panel esta visible, se usa la del fragment SideBar (IDs sb*);
      //   - en caso contrario, se asume Dialog y se devuelve la del fragment Dialog.
      //   Asi los handlers compartidos (selectionChange, anyadir/editar/borrar,
      //   anyadir al desglose) funcionan indistintamente sobre ambos contenedores
      //   sin duplicar codigo.  
      _getCatalogoTable: function () {
        var oSideBar = this.byId("catalogoRecursosSideBar");
        if (oSideBar && oSideBar.getVisible()) {
          return this.byId("sbCatalogoRecursosTable");
        }
        return this.byId("catalogoRecursosTable");
      },
      //    

      
     _loadCatalogoRecursos: async function () {
        var oAppData = this.getGlobalModel("appData").getData();
        //   El "Prctr de obra" identifica los recursos del centro/obra actual frente a
        //   los del nodo superior (recursos generales). Se toma de tramo.Prctr y, si no
        //   está disponible, del initialNode (centro de coste activo), que para una obra
        //   coincide con su Prctr. Sin este fallback, cuando tramo.Prctr venía vacío todos
        //   los recursos caían en la pestaña "generales" y la de "obra" salía vacía.
        var sPrctrObra = (oAppData && oAppData.tramo && oAppData.tramo.Prctr) ||
                         (oAppData && oAppData.userData && oAppData.userData.initialNode) || "";
        var sLang = (oAppData && oAppData.userData && oAppData.userData.AplicationLangu) || "ES";
        var sPuestoField = "Puesto" + sLang.charAt(0).toUpperCase() + sLang.charAt(1).toLowerCase();

        //    la carga al abrir el popup ya NO incluye Generales: el usuario pidio que /SelectCatIndirNodoSet se llame perezosamente al cambiar a la pestaña, no al abrir el dialogo. Aqui se carga solo Obra (/SelectCatalogoIndirSet); Generales lo gestiona _loadCatalogoRecursosGenerales, disparada desde onCatalogoSegmentChange la primera vez que se hace click en su segmento  
        var oOptsObra = {
          headers: {
            ambito: oAppData.userData.initialNode,
            token: oAppData.EvToken || "",
            lang: oAppData.userData.AplicationLangu
          }
        };
        var oRespObra = null;
        try {
          oRespObra = await this.post(
            this.getGlobalModel("mainService"),
            "/SelectCatalogoIndirSet",
            { "NavMensajes": [], "NavIndCatalogo": [] },
            oOptsObra
          );
        } catch (e) {
          console.error("[_loadCatalogoRecursos] obra", e);
        }
        //   

        //   El modelo OData v2 normalmente desenvuelve el wrapper "d", pero se contempla
        //   por si la respuesta llega cruda (response.d.NavIndCatalogo) para que las tablas
        //   no queden vacías.
        var oRespObraD = (oRespObra && oRespObra.d) ? oRespObra.d : oRespObra;

        var aMensajesError = ((oRespObraD && oRespObraD.NavMensajes && oRespObraD.NavMensajes.results) || [])
          .filter(function (m) { return m.Tipo === "E"; });
        if (aMensajesError.length > 0) {
          this.createMessageDialog({
            title: this.getTranslatedText("ERROR"),
            textAccept: this.getTranslatedText("ACEPTAR"),
            messages: aMensajesError.map(function (m) {
              return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
            })
          });
        }

        //    helper interno: normaliza una fila del catalogo (clon defensivo, sin __metadata, con campo Puesto resuelto por idioma activo)  
        var fnNormalizar = function (oRow) {
          var oClone = Object.assign({}, oRow);
          delete oClone.__metadata;
          oClone.Puesto = oClone[sPuestoField] || oClone.PuestoEs || oClone.PuestoEn || oClone.PuestoFr || "";
          return oClone;
        };
        //   

        var aObra = [];
        var aRecursosObra = (oRespObraD && oRespObraD.NavIndCatalogo && oRespObraD.NavIndCatalogo.results) || [];
        aRecursosObra.forEach(function (oRow) {
          var oClone = fnNormalizar(oRow);
          if (!sPrctrObra || oClone.Prctr === sPrctrObra) {
            aObra.push(oClone);
          }
        });

        var oCatalogoModel = this.getView().getModel("catalogoRecursosModel");
        //   Se conserva la pestaña activa actual (por si se recarga el catálogo tras una
        //   importación) y se rellena "visible" con la lista correspondiente.
        var sActiveKey = oCatalogoModel.getProperty("/activeKey") || "obra";
        //   Se preserva openedFromVH al recargar: el setData reemplaza el objeto entero, asi que sin esto la flag se perdia y los botones Añadir/Editar/Borrar reaparecian incluso cuando el dialogo se habia abierto desde el value-help
        var bOpenedFromVH = oCatalogoModel.getProperty("/openedFromVH") === true;
        //    tras una operacion Mant (Alta/Edit/Borrar) este metodo se vuelve a llamar para refrescar Obra; conviene preservar el estado de Generales (datos ya cargados + flag generalesLoaded) para no perderlos y no forzar una nueva llamada  
        var aGeneralesPrev = oCatalogoModel.getProperty("/generales") || [];
        var bGeneralesLoaded = oCatalogoModel.getProperty("/generalesLoaded") === true;
        //   
        oCatalogoModel.setData({
          obra: aObra,
          //    generales conserva lo previo: ningun fetch nuevo aqui  
          generales: aGeneralesPrev,
          //   
          visible: sActiveKey === "generales" ? aGeneralesPrev : aObra,
          activeKey: sActiveKey,
          obraPrctr: sPrctrObra,
          hasSelection: false,
          openedFromVH: bOpenedFromVH,
          //    flag de lazy load: se respeta el valor previo asi onCatalogoSegmentChange decide si lanzar o no la llamada  
          generalesLoaded: bGeneralesLoaded
          //   
        });
      },

      //    carga perezosa de la pestaña Generales contra /SelectCatIndirNodoSet. Se dispara desde onCatalogoSegmentChange la primera vez que el usuario cambia a la pestaña. Mismas estructura/headers que Obra mas "norma" y "prctr" porque el catalogo del nodo superior se localiza por centro de coste + normativa y este endpoint, al no estar atado a un tramo concreto, puede necesitarlos explicitos. La respuesta se vuelca solo en /generales (y en /visible si la pestaña sigue activa) sin tocar Obra; se setea el flag /generalesLoaded para evitar refetches en clicks sucesivos  
      _loadCatalogoRecursosGenerales: async function () {
        var oCatalogoModel = this.getView().getModel("catalogoRecursosModel");
        if (!oCatalogoModel) return;
        var oAppData = this.getGlobalModel("appData").getData();
        var sPrctrObra = (oAppData && oAppData.tramo && oAppData.tramo.Prctr) ||
                         (oAppData && oAppData.userData && oAppData.userData.initialNode) || "";
        var sLang = (oAppData && oAppData.userData && oAppData.userData.AplicationLangu) || "ES";
        var sPuestoField = "Puesto" + sLang.charAt(0).toUpperCase() + sLang.charAt(1).toLowerCase();
        var oNormModel = this.getGlobalModel("normModel");
        var sNorma = (oNormModel && oNormModel.getData && oNormModel.getData().norma) || "";

        var oRespGen = null;
        try {
          oRespGen = await this.post(
            this.getGlobalModel("mainService"),
            "/SelectCatIndirNodoSet",
            { "NavMensajes": [], "NavIndCatalogo": [] },
            {
              headers: {
                ambito: oAppData.userData.initialNode,
                token: oAppData.EvToken || "",
                lang: oAppData.userData.AplicationLangu,
                norma: sNorma,
                prctr: sPrctrObra
              }
            }
          );
        } catch (e) {
          console.error("[_loadCatalogoRecursosGenerales]", e);
        }

        var oRespD = (oRespGen && oRespGen.d) ? oRespGen.d : oRespGen;
        var aMensajesError = ((oRespD && oRespD.NavMensajes && oRespD.NavMensajes.results) || [])
          .filter(function (m) { return m.Tipo === "E"; });
        if (aMensajesError.length > 0) {
          this.createMessageDialog({
            title: this.getTranslatedText("ERROR"),
            textAccept: this.getTranslatedText("ACEPTAR"),
            messages: aMensajesError.map(function (m) {
              return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
            })
          });
        }

        var aGenerales = [];
        var aRecursosGen = (oRespD && oRespD.NavIndCatalogo && oRespD.NavIndCatalogo.results) || [];
        aRecursosGen.forEach(function (oRow) {
          var oClone = Object.assign({}, oRow);
          delete oClone.__metadata;
          oClone.Puesto = oClone[sPuestoField] || oClone.PuestoEs || oClone.PuestoEn || oClone.PuestoFr || "";
          aGenerales.push(oClone);
        });

        oCatalogoModel.setProperty("/generales", aGenerales);
        // Si el usuario sigue en la pestaña generales (no la cambio durante el fetch) se refresca tambien /visible
        if (oCatalogoModel.getProperty("/activeKey") === "generales") {
          oCatalogoModel.setProperty("/visible", aGenerales);
        }
        oCatalogoModel.setProperty("/generalesLoaded", true);
      },
      //   

      //   Alterna la lista mostrada por la tabla del catálogo (Obra / Generales) al
      //   pulsar el SegmentedButton, limpiando la selección previa.
      //    async + lazy fetch de Generales la primera vez que el usuario cambia a esa pestaña. /generalesLoaded actua como cache para no relanzar la llamada en clicks sucesivos dentro de la misma sesion del popup; al cerrar y reabrir el dialogo el flag se reinicia en onAbrirCatalogoRecursos  
      onCatalogoSegmentChange: async function (oEvent) {
        var oModel = this.getView().getModel("catalogoRecursosModel");
        if (!oModel) return;
        var oItem = oEvent.getParameter("item");
        var sKey = oItem ? oItem.getKey() : (oEvent.getSource().getSelectedKey() || "obra");
        oModel.setProperty("/activeKey", sKey);
        oModel.setProperty("/visible", oModel.getProperty("/" + sKey) || []);
        oModel.setProperty("/hasSelection", false);
        //     Se resuelve la tabla via _getCatalogoTable para limpiar la
        //   seleccion del contenedor activo (Dialog o side panel).  
        var oTable = this._getCatalogoTable();
        //    
        if (oTable && oTable.removeSelections) oTable.removeSelections(true);
        //    lazy load: solo se llama a /SelectCatIndirNodoSet cuando el usuario entra en la pestaña Generales por primera vez. Se gestiona aqui (y no en onAbrirCatalogoRecursos) para no pagar la latencia del segundo endpoint cuando el usuario solo necesita Obra  
        if (sKey === "generales" && oModel.getProperty("/generalesLoaded") !== true) {
          await this._loadCatalogoRecursosGenerales();
        }
        //   
      },
      //   
 

      onCloseCatalogoRecursosDialog: function () {
        //   Se limpia el contexto del value-help DESCRIP por si el usuario cancela sin seleccionar
        this._sDescripVHRowPath = null;
        this._sDescripVHTableModel = null;
         var oCorrientesView = this._mViews && this._mViews["corrientes"];
        var oCorrientesController = oCorrientesView && oCorrientesView.getController();
        if (oCorrientesController && typeof oCorrientesController.getControlTable === "function") {
          var oTreeTable = oCorrientesController.getControlTable();
          if (oTreeTable && typeof oTreeTable.clearSelection === "function") {
            oTreeTable.clearSelection();
          }
        }
        //
        //     Se deseleccionan las filas marcadas en AMBOS contenedores
        //   del catalogo (Dialog y side panel) porque solo uno esta visible cada vez
        //   pero el otro puede haber quedado con seleccion residual de una apertura
        //   previa. removeSelections es defensivo y no rompe si la tabla no esta
        //   instanciada (caso del Dialog si nunca se ha abierto desde VH).  
        var oCatalogoTableDialog = this.byId("catalogoRecursosTable");
        if (oCatalogoTableDialog && typeof oCatalogoTableDialog.removeSelections === "function") {
          oCatalogoTableDialog.removeSelections(true);
        }
        var oCatalogoTableSideBar = this.byId("sbCatalogoRecursosTable");
        if (oCatalogoTableSideBar && typeof oCatalogoTableSideBar.removeSelections === "function") {
          oCatalogoTableSideBar.removeSelections(true);
        }
        //    
        //   Tambien hay que limpiar el flag hasSelection del modelo: si no, el
        // boton "Añadir al desglose" queda habilitado pese a no haber filas
        // marcadas en la siguiente apertura.
        var oCatalogoModelClose = this.getView().getModel("catalogoRecursosModel");
        if (oCatalogoModelClose && oCatalogoModelClose.setProperty) {
          oCatalogoModelClose.setProperty("/hasSelection", false);
        }
        //
        if (this._oCatalogoRecursosDialog) {
          this._oCatalogoRecursosDialog.close();
        }
        //     Se cierra tambien el side panel para que tras "Anyadir al
        //   desglose" o cancelacion programatica el contenedor lateral desaparezca,
        //   igual que el Dialog.  
        var oSideBarClose = this.byId("catalogoRecursosSideBar");
        if (oSideBarClose && oSideBarClose.getVisible()) {
          oSideBarClose.setVisible(false);
        }
        //    
      },

      //   Se actualiza el flag hasSelection cuando cambia la selección de cualquiera
      //   de las dos tablas del catálogo, para habilitar/deshabilitar el botón
      //   "Añadir al desglose".
      onCatalogoRecursoSelectionChange: function (oEvent) {
        var oModel = this.getView().getModel("catalogoRecursosModel");
        if (!oModel) return;
        var oTable = oEvent.getSource();
        //   En modo MultiSelect la habilitacion del boton depende de
        // si existe al menos una fila marcada (no de una unica seleccion)
        var aSelected = (oTable.getSelectedItems && oTable.getSelectedItems()) || [];
        oModel.setProperty("/hasSelection", aSelected.length > 0);
        //  
      },

      //   Vuelca el recurso seleccionado en el catálogo como una nueva fila de
      //   desglose (bloque custom) bajo la operación seleccionada en la tabla de
      //   Corrientes. Delega la creación de la fila en el controller de Corrientes
      //   (addRecursoCatalogoAlDesglose) y cierra el diálogo si el volcado es correcto.
      onAddRecursoToDesglose: function () {
        //     Se resuelve la tabla via _getCatalogoTable para que el
        //   volcado al desglose funcione tanto desde el Dialog como desde el side panel.  
        var oTable = this._getCatalogoTable();
        //    
        if (!oTable) return;

        //   Lectura multiseleccion: getSelectedItems en vez de getSelectedItem
        var aItems = (oTable.getSelectedItems && oTable.getSelectedItems()) || [];
        if (aItems.length === 0) {
          MessageToast.show(this.getTranslatedText("ERROR_SELECCIONE_RECURSO"));
          return;
        }
        //   Se construye la lista de recursos seleccionados resolviendo el
        // binding context de cada item. Se descartan los items sin contexto.
        var aRecursos = aItems.map(function (oItem) {
          var oCtx = oItem.getBindingContext("catalogoRecursosModel");
          return oCtx && oCtx.getObject();
        }).filter(function (oRec) { return !!oRec; });
        if (aRecursos.length === 0) {
          MessageToast.show(this.getTranslatedText("ERROR_SELECCIONE_RECURSO"));
          return;
        }
        //  

        //   Si el dialogo se abrio desde el value-help del Input DESCRIP, el PRIMER recurso seleccionado rellena la fila editable abierta y los N-1 restantes se vuelcan como filas nuevas debajo, en la misma operacion. Asi el flujo VH soporta multiseleccion sin perder recursos
        if (this._sDescripVHRowPath && this._sDescripVHTableModel) {
          var oCorrientesViewVH = this._mViews && this._mViews["corrientes"];
          var oCorrientesControllerVH = oCorrientesViewVH && oCorrientesViewVH.getController();
          var sPathVH = this._sDescripVHRowPath;
          var sModelVH = this._sDescripVHTableModel;
          //   Se limpia el contexto ANTES de aplicar para que el siguiente "Añadir
          // al desglose" desde el menu vuelva al flujo de creacion de fila nueva.
          this._sDescripVHRowPath = null;
          this._sDescripVHTableModel = null;

          if (!oCorrientesControllerVH || typeof oCorrientesControllerVH._aplicarRecursoAFilaEditable !== "function") {
            MessageBox.error(this.getTranslatedText("ERROR_AL_CARGAR"));
            return;
          }
          //   Paso 1: el primero rellena la fila editable abierta (su path
          // sigue siendo valido porque aun no se ha tocado el modelo).
          var oResultVH = oCorrientesControllerVH._aplicarRecursoAFilaEditable(aRecursos[0], sPathVH, sModelVH);
          if (!oResultVH || !oResultVH.ok) {
            MessageBox.error((oResultVH && oResultVH.message) || this.getTranslatedText("ERROR_AL_CARGAR"));
            return;
          }
          //   Paso 2: si hay mas recursos seleccionados, se vuelcan en bloque
          // como filas nuevas. Se deriva el path de la operacion quitando el
          // sufijo /children/N del path de la fila editable: el padre directo
          // de una fila editable es la operacion de nivel 2. Pasando el path
          // se evita depender de la seleccion de la TreeTable (que puede no
          // existir cuando el dialogo se ha abierto desde el value-help).
          if (aRecursos.length > 1 && typeof oCorrientesControllerVH.addRecursosCatalogoAlDesgloseBatch === "function") {
            var sOperationPathVH = sPathVH.replace(/\/children\/\d+$/, "");
            oCorrientesControllerVH.addRecursosCatalogoAlDesgloseBatch(aRecursos.slice(1), sOperationPathVH);
          }
          this.onCloseCatalogoRecursosDialog();
          MessageToast.show(this.getTranslatedText("MSG_RECURSO_VOLCADO"));
          return;
        }
        //  

        var oCorrientesView = this._mViews && this._mViews["corrientes"];
        var oCorrientesController = oCorrientesView && oCorrientesView.getController();
        if (!oCorrientesController) {
          MessageBox.error(this.getTranslatedText("ERROR_AL_CARGAR"));
          return;
        }

        //   Insercion en bloque via addRecursosCatalogoAlDesgloseBatch: resuelve la operacion seleccionada UNA sola vez y mete las N filas en un solo refresh. Antes se llamaba en bucle a addRecursoCatalogoAlDesglose, pero su refresh(true) intermedio borraba la seleccion de la TreeTable y solo se insertaba la primera fila
        if (typeof oCorrientesController.addRecursosCatalogoAlDesgloseBatch !== "function") {
          MessageBox.error(this.getTranslatedText("ERROR_AL_CARGAR"));
          return;
        }
        var oResultBatch = oCorrientesController.addRecursosCatalogoAlDesgloseBatch(aRecursos);
        if (oResultBatch && oResultBatch.ok) {
          this.onCloseCatalogoRecursosDialog();
          MessageToast.show(this.getTranslatedText("MSG_RECURSO_VOLCADO"));
        } else {
          MessageBox.error((oResultBatch && oResultBatch.message) || this.getTranslatedText("ERROR_AL_CARGAR"));
        }
        //  
      },

      //   Gestión del catálogo (alta/edición/borrado de recursos e importación/
      //   exportación): pendiente de los endpoints de backend sobre ZIND_CATALOGO.
      //   Se dejan stubs para que los botones del fragment no rompan al pulsarlos.
      //

      //    helper unico para la persistencia del catalogo de recursos contra el nuevo endpoint /MantCatalogoIndirSet publicado por backend (Ismael). Acepta una lista de filas y un Status (I=alta, U=modificacion, D=baja) que se inyecta en cada fila antes del envio. Devuelve la response cruda para que el llamador decida si recargar el catalogo o mezclar in-place; los errores de NavMensajes se centralizan aqui para no repetir el patron de createMessageDialog en cada handler  
      _callMantCatalogoIndirSet: async function (aRecursos, sStatus) {
        if (!Array.isArray(aRecursos) || aRecursos.length === 0) return null;
        if (sStatus !== "I" && sStatus !== "U" && sStatus !== "D") {
          //    se rechaza explicitamente un Status desconocido para evitar enviar al backend un valor que no este en el contrato I/U/D acordado con Ismael  
          throw new Error("MantCatalogoIndir: Status invalido (" + sStatus + ")");
          //   
        }
        var oAppData = this.getGlobalModel("appData").getData();
        //    se construye el payload clonando cada fila para no contaminar el modelo visible (catalogoRecursosModel) con claves internas. El flag I/U/D NO viaja como property en cada fila (el gateway rechaza Property 'Status' is invalid: la entity de NavIndCatalogo no lo declara) sino como HEADER de la peticion, en linea con como ha pedido Ismael "pasandole aparte del ambito y todo como siempre, Status: D" - "aparte del ambito" = junto a los demas headers  
        //    backend almacena el puesto en tres columnas lang-specific (PuestoEs / PuestoEn / PuestoFr). El cliente trabaja con un unico campo "Puesto" derivado en _loadCatalogoRecursos a partir del idioma activo y, en el alta, alimentado directamente por el Input del popup. Antes de enviar, se vuelca el valor de "Puesto" al campo lang-specific correspondiente al idioma del usuario para que backend lo entienda; despues se elimina "Puesto" porque no es una property declarada en la entity de NavIndCatalogo y el gateway lo rechazaria  
        var sLang = (oAppData && oAppData.userData && oAppData.userData.AplicationLangu) || "ES";
        var sPuestoField = "Puesto" + sLang.charAt(0).toUpperCase() + sLang.charAt(1).toLowerCase();
        //   
        var aPayload = aRecursos.map(function (oRow) {
          var oClone = Object.assign({}, oRow);
          delete oClone.__metadata;
          delete oClone.__editMode;
          delete oClone.__isNew;
          //    se preserva el valor "Puesto" mapeandolo al campo lang-specific antes de borrarlo  
          if (oClone.Puesto !== undefined && oClone.Puesto !== null) {
            oClone[sPuestoField] = oClone.Puesto;
          }
          //   
          delete oClone.Puesto;
          return oClone;
        });
        //   
        var response = await this.post(
          this.getGlobalModel("mainService"),
          "/MantCatalogoIndirSet",
          {
            "NavMensajes": [],
            "NavIndCatalogo": aPayload
          },
          {
            headers: {
              ambito: oAppData.userData.initialNode,
              token: oAppData.EvToken || "",
              lang: oAppData.userData.AplicationLangu,
              //    flag I/U/D enviado como header de la peticion; nombre del header "estatus" todo en minusculas tal como espera el handler de Ismael en MantCatalogoIndirSet  
              estatus: sStatus
              //   
            }
          }
        );
        //    misma logica de unwrap "d" + concentracion de mensajes de error en un solo dialogo que ya se usa en _loadCatalogoRecursos: si backend devuelve algun Tipo=E se aborta el flujo lanzando una excepcion para que el handler llamante (onSave/onEdit/onDelete) no actualice el modelo local con datos no persistidos  
        var oResp = (response && response.d) ? response.d : response;
        var aMensajesError = ((oResp && oResp.NavMensajes && oResp.NavMensajes.results) || [])
          .filter(function (m) { return m.Tipo === "E"; });
        if (aMensajesError.length > 0) {
          this.createMessageDialog({
            title: this.getTranslatedText("ERROR"),
            textAccept: this.getTranslatedText("ACEPTAR"),
            messages: aMensajesError.map(function (m) {
              return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
            })
          });
          var oErr = new Error("MantCatalogoIndir devolvio mensajes de error");
          oErr.backendMessages = aMensajesError;
          throw oErr;
        }
        return oResp;
        //   
      },
      //   

      //   Añade una fila vacia en modo edicion al inicio del catalogo de obra.
      // Los tres campos (IdRecurso, Puesto, Fee) quedan vacios y, por el binding
      // inline de valueState, los Input se marcan automaticamente en rojo hasta
      // que el usuario los rellene. La persistencia en backend (ZIND_CATALOGO)
      // se atara mas adelante; ahora todo el cambio vive en catalogoRecursosModel.
      //    el alta deja de ser una fila inline editable: ahora abre un popup dedicado (AddRecursoCatalogoDialog) que solo envia los datos al backend cuando el usuario pulsa Guardar. Sigue restringido a la pestaña obra porque generales es read-only por contrato  
      onAddRecursoCatalogo: async function () {
        var oModel = this.getView().getModel("catalogoRecursosModel");
        if (!oModel) return;
        var sActiveKey = oModel.getProperty("/activeKey") || "obra";
        if (sActiveKey !== "obra") {
          MessageToast.show(this.getTranslatedText("workInPregress"));
          return;
        }
        //    modelo dedicado del popup en modo "add": campos vacios, Prctr de la obra activa (lo necesita backend para clasificar el recurso) y flag busy para deshabilitar el boton Guardar durante el envio. El campo /mode hace que el mismo fragment se use tambien para Editar reusando bindings via expression binding sobre /mode  
        var oAddModel = new JSONModel({
          mode: "add",
          IdRecurso: "",
          Puesto: "",
          Fee: "",
          Prctr: oModel.getProperty("/obraPrctr") || "",
          busy: false
        });
        this.getView().setModel(oAddModel, "addRecursoModel");
        //   
        //    carga perezosa del fragment con cache en la instancia del controller; addDependent garantiza que el dialogo herede los modelos (i18n, addRecursoModel) de la vista  
        if (!this._oAddRecursoCatalogoDialog) {
          this._oAddRecursoCatalogoDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "zindirect_costs.fragments.AddRecursoCatalogoDialog",
            controller: this
          });
          this.getView().addDependent(this._oAddRecursoCatalogoDialog);
        }
        //   
        this._oAddRecursoCatalogoDialog.open();
      },
      //   

      //    Cancelar del popup: cierra el dialogo sin enviar nada al backend; el modelo addRecursoModel se descarta al proximo open  
      onCloseAddRecursoCatalogoDialog: function () {
        if (this._oAddRecursoCatalogoDialog) {
          this._oAddRecursoCatalogoDialog.close();
        }
      },
      //   

      //    Guardar del popup unico (Alta y Edit): valida los 3 campos (trim defensivo), elige Estatus segun /mode (I = alta, U = edit), llama a /MantCatalogoIndirSet y, si el backend confirma, cierra el dialogo y recarga el catalogo para que la fila aparezca con el formato canonico del backend (Puesto por idioma, etc.) en vez de fabricarla a mano en el cliente. En modo edit se reenvian ademas todos los campos no editables que vinieron del Select (Mandt, Version y resto de claves) para no romper la integridad referencial  
      onSaveAddRecursoCatalogo: async function () {
        var oAddModel = this.getView().getModel("addRecursoModel");
        if (!oAddModel) return;
        var oData = oAddModel.getData() || {};
        var bIdOk = ((oData.IdRecurso || "") + "").trim() !== "";
        var bPuestoOk = ((oData.Puesto || "") + "").trim() !== "";
        var bFeeOk = ((oData.Fee || "") + "").trim() !== "";
        if (!bIdOk || !bPuestoOk || !bFeeOk) {
          MessageToast.show(this.getTranslatedText("catalogoRecursosRellenarCampos"));
          return;
        }
        //    el mode decide tanto el Estatus enviado a backend como el mensaje de exito mostrado al usuario; "edit" cubre el flujo de modificacion, cualquier otro valor (por defecto "add") cubre el alta  
        var bEdit = oData.mode === "edit";
        var sEstatus = bEdit ? "U" : "I";
        //   
        oAddModel.setProperty("/busy", true);
        try {
          //    en alta solo se envian las 4 properties que rellena el usuario; en edit se clona el objeto completo (que ya trae Mandt, Version y demas campos no editables del Select) y se sobreescriben las 3 properties editables con lo que haya en el modelo del popup, para que backend reciba la fila completa y pueda identificar la clave
          var oRowEnvio;
          if (bEdit) {
            oRowEnvio = Object.assign({}, oData);
            // limpieza de campos que solo sirven al popup
            delete oRowEnvio.mode;
            delete oRowEnvio.busy;
            delete oRowEnvio.__originalIdRecurso; //     no enviar el snapshot al backend
          } else {
            oRowEnvio = {
              IdRecurso: oData.IdRecurso,
              Puesto: oData.Puesto,
              Fee: oData.Fee,
              Prctr: oData.Prctr || ""
            };
          }
          //
          //     
          //   Si el usuario ha cambiado IdRecurso durante el edit (parte de la clave
          //   primaria del catalogo: Mandt+Version+Prctr+IdRecurso), un Update plano
          //   falla porque el backend busca el registro con la nueva clave y no existe.
          //   Se transforma en una secuencia atomica desde el punto de vista de UX:
          //     1) Insert (I) con la fila completa y el nuevo IdRecurso
          //     2) Solo si el insert ha tenido exito, Delete (D) del registro antiguo
          //   El orden Insert-primero es deliberado: si la inserción falla, el original
          //   queda intacto y el usuario no pierde datos. Si el delete falla despues,
          //   quedan dos registros (viejo+nuevo) pero el dato no se pierde.
          var sOriginalId = (oData.__originalIdRecurso || "") + "";
          var sCurrentId = (oData.IdRecurso || "") + "";
          var bIdChanged = bEdit && sOriginalId !== "" && sOriginalId !== sCurrentId;
          if (bIdChanged) {
            //   Insert con la fila nueva (incluye los datos modificados Puesto/Fee).
            await this._callMantCatalogoIndirSet([oRowEnvio], "I");
            //   Delete del registro original: se construye un payload minimo con las
            //   claves que el backend necesita para identificarlo (Mandt+Version+Prctr
            //   estan ya en oData porque vienen del Select original; solo se
            //   sobreescribe el IdRecurso con el valor antiguo).
            var oRowDelete = Object.assign({}, oData);
            delete oRowDelete.mode;
            delete oRowDelete.busy;
            delete oRowDelete.__originalIdRecurso;
            oRowDelete.IdRecurso = sOriginalId;
            await this._callMantCatalogoIndirSet([oRowDelete], "D");
          } else {
            await this._callMantCatalogoIndirSet([oRowEnvio], sEstatus);
          }
          //    
          //    en caso de exito se cierra el popup y se recarga el catalogo desde backend; asi la nueva fila se sincroniza sin tener que duplicar la logica de normalizacion (campos Puesto por idioma, etc.)  
          if (this._oAddRecursoCatalogoDialog) {
            this._oAddRecursoCatalogoDialog.close();
          }
          MessageToast.show(this.getTranslatedText(bEdit ? "catalogoRecursosEditOk" : "catalogoRecursosAltaOk"));
          await this._loadCatalogoRecursos();
          //   
        } catch (error) {
          //    los mensajes de error de backend ya los muestra _callMantCatalogoIndirSet via createMessageDialog; aqui solo se libera el flag busy y se loguea para diagnostico  
          console.error("[onSaveAddRecursoCatalogo]", error);
          //   
        } finally {
          oAddModel.setProperty("/busy", false);
        }
      },
      //   
      //   Activa/desactiva el modo edicion sobre la fila seleccionada. Si la
      // fila ya esta en edicion, intenta consolidarla: solo sale del modo
      // edicion si los tres campos estan rellenos; en caso contrario muestra
      // un MessageToast (el feedback visual de los campos vacios ya viene del
      // valueState=Error enlazado inline en la vista). Requiere exactamente
      // una fila seleccionada para evitar ambiguedad.
      //    Editar abre el mismo popup que Alta pero en modo "edit", prefillado con todos los campos de la fila seleccionada. La llamada a /MantCatalogoIndirSet con Estatus=U sale solo cuando el usuario pulsa "Guardar cambios" en el popup (handler unificado onSaveAddRecursoCatalogo). Asi se elimina el flujo de edit inline confuso (que entraba/salia del modo edit por sus propios medios) y se unifican alta y modificacion bajo el mismo dialogo. Restringido a pestaña obra: en generales el mantenimiento esta deshabilitado por contrato con backend  
      onEditRecursoCatalogo: async function () {
        //     Se resuelve la tabla via _getCatalogoTable para que el
        //   handler Editar opere sobre el contenedor activo (Dialog o side panel).  
        var oTable = this._getCatalogoTable();
        //    
        if (!oTable) return;
        var oModel = this.getView().getModel("catalogoRecursosModel");
        if (!oModel) return;
        var sActiveKey = oModel.getProperty("/activeKey") || "obra";
        if (sActiveKey !== "obra") {
          MessageToast.show(this.getTranslatedText("workInPregress"));
          return;
        }
        var aItems = (oTable.getSelectedItems && oTable.getSelectedItems()) || [];
        if (aItems.length !== 1) {
          MessageToast.show(this.getTranslatedText("catalogoRecursosSeleccionUnica"));
          return;
        }
        var oCtx = aItems[0].getBindingContext("catalogoRecursosModel");
        var oRecurso = oCtx && oCtx.getObject();
        if (!oRecurso) return;

        //    se clona la fila completa al modelo del popup para preservar las claves (Mandt, Version, Prctr, IdRecurso) que el usuario no edita pero backend necesita para identificar el registro. Se anaden los flags propios del popup: mode="edit" gobierna el binding via expression (titulo, texto del boton Guardar y editable de IdRecurso); busy=false arranca con el boton activo  
        var oRowClon = Object.assign({}, oRecurso);
        delete oRowClon.__metadata;
        delete oRowClon.__editMode;
        delete oRowClon.__isNew;
        oRowClon.mode = "edit";
        oRowClon.busy = false;
        //     
        //   Se snapshot del IdRecurso original ANTES de que el usuario edite el campo
        //   en el popup. El IdRecurso forma parte de la clave (Mandt+Version+Prctr+IdRecurso)
        //   y si el usuario lo cambia, el backend ya no puede aplicar un Update sobre el
        //   registro original. onSaveAddRecursoCatalogo usa este snapshot para detectar
        //   el cambio de clave y disparar Insert(nuevo)+Delete(viejo) en lugar de Update.
        //    
        oRowClon.__originalIdRecurso = oRecurso.IdRecurso || "";
        var oAddModel = new JSONModel(oRowClon);
        this.getView().setModel(oAddModel, "addRecursoModel");
        //   

        //    carga perezosa del fragment con cache; mismo patron que onAddRecursoCatalogo  
        if (!this._oAddRecursoCatalogoDialog) {
          this._oAddRecursoCatalogoDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "zindirect_costs.fragments.AddRecursoCatalogoDialog",
            controller: this
          });
          this.getView().addDependent(this._oAddRecursoCatalogoDialog);
        }
        //   
        this._oAddRecursoCatalogoDialog.open();
      },
      //   
      //  
      //  
      //   Handlers de cambio sobre los tres campos editables de una fila del
      // catalogo (IdRecurso, Puesto, Fee). Estan separados por restriccion de
      // naming del linter del proyecto (pattern /^on{Campo}Input.*?Change$/),
      // pero los tres delegan en el mismo helper que consolida la fila cuando
      // los tres campos quedan llenos.
      onIdRecursoInputChange: function (oEvent) {
        this._consolidarFilaCatalogoSiCompleta(oEvent);
      },
      onPuestoInputChange: function (oEvent) {
        this._consolidarFilaCatalogoSiCompleta(oEvent);
      },
      onFeeInputChange: function (oEvent) {
        this._consolidarFilaCatalogoSiCompleta(oEvent);
      },
      //   liveChange del Input Fee: se ejecuta a cada tecla y filtra todo lo
      // que no sea digito o separador decimal (punto o coma). El cursor se
      // mantiene al final por simplicidad: en un campo numerico el caso de
      // edicion en mitad de la cadena es raro y reposicionarlo introduce
      // bugs sutiles (selecciones, IME, etc.).
      onFeeInputLiveChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var sValue = oEvent.getParameter("value") != null ? oEvent.getParameter("value") : oInput.getValue();
        var sFiltrado = (sValue || "").replace(/[^0-9.,]/g, "");
        if (sFiltrado !== sValue) {
          //   Se actualiza el modelo via setValue (que dispara el two-way
          // binding) en vez de tocar el modelo a mano: asi el valueState
          // ligado al binding se recalcula correctamente.
          oInput.setValue(sFiltrado);
        }
      },
      //    ANTES esta funcion sacaba a la fila del modo edicion automaticamente al detectar los tres campos llenos. Eso entraba en conflicto con el flujo de Editar cableado al backend: en cuanto el usuario modificaba un campo el auto-exit volvia la fila a modo lectura, asi que el segundo click en "Editar" volvia a entrar en edit en lugar de disparar el POST a MantCatalogoIndirSet con Estatus=U y la llamada nunca salia. Se neutraliza el helper (no-op) para que la fila se mantenga editable hasta que el usuario pulse explicitamente Editar por segunda vez, que es el momento en el que onEditRecursoCatalogo valida y manda el cambio a backend. Los handlers onIdRecursoInputChange / onPuestoInputChange / onFeeInputChange se conservan vacios para no romper los nombres referenciados desde el fragment XML ni la convencion de naming del linter UI5  
      _consolidarFilaCatalogoSiCompleta: function (/* oEvent */) {
        // No-op intencional: ver comentario superior.
      },
      //   
      //  

      //  
      //   Elimina del catalogo (lista de obra) todas las filas seleccionadas.
      // Solo opera sobre la lista de OBRA: los recursos generales pertenecen
      // al nodo superior y no se borran desde la obra actual. El cambio vive
      // en catalogoRecursosModel; el borrado en backend se atara cuando exista
      // el endpoint de baja sobre ZIND_CATALOGO.
      //    Borrar acepta multiseleccion y, ANTES de cualquier llamada a backend, pide confirmacion al usuario con un MessageBox.confirm. Solo si el usuario pulsa Aceptar se envia /MantCatalogoIndirSet con Estatus=D. Tras la confirmacion del backend se recarga el catalogo desde el servidor (en vez de filtrar in-place) para garantizar consistencia con eventuales borrados encadenados o validaciones de integridad referencial  
      onDeleteRecursoCatalogo: function () {
        //     Se resuelve la tabla via _getCatalogoTable para que el
        //   handler Borrar opere sobre el contenedor activo (Dialog o side panel).  
        var oTable = this._getCatalogoTable();
        //    
        if (!oTable) return;
        var aItems = (oTable.getSelectedItems && oTable.getSelectedItems()) || [];
        if (aItems.length === 0) {
          MessageToast.show(this.getTranslatedText("catalogoRecursosSeleccionBorrar"));
          return;
        }
        var oModel = this.getView().getModel("catalogoRecursosModel");
        if (!oModel) return;
        //   Solo tiene sentido borrar recursos de la lista de OBRA.
        var sActiveKey = oModel.getProperty("/activeKey") || "obra";
        if (sActiveKey !== "obra") {
          MessageToast.show(this.getTranslatedText("workInPregress"));
          return;
        }
        //   Se construye un set de referencias de objeto a borrar. Comparar por
        // referencia (Set + indexOf) es robusto incluso si IdRecurso esta vacio
        // (caso de filas recien creadas con __isNew y aun sin id).
        var aObjetosABorrar = aItems.map(function (oItem) {
          var oCtx = oItem.getBindingContext("catalogoRecursosModel");
          return oCtx && oCtx.getObject();
        }).filter(function (oRec) { return !!oRec; });
        if (aObjetosABorrar.length === 0) return;

        //    confirmacion previa al envio: si el usuario cancela no se llama a backend ni se modifica el modelo local. El mensaje se compone con el numero de filas seleccionadas para que el usuario sepa cuantas se van a borrar; los textos de boton se traducen via i18n para mantener el dialogo coherente con el resto de la app  
        var sMsg = this.getTranslatedText("catalogoRecursosConfirmBorrar").replace("{0}", aObjetosABorrar.length);
        var that = this;
        MessageBox.confirm(sMsg, {
          title: this.getTranslatedText("catalogoRecursosConfirmBorrarTitle"),
          actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
          emphasizedAction: MessageBox.Action.OK,
          onClose: async function (sAction) {
            if (sAction !== MessageBox.Action.OK) return;
            try {
              await that._callMantCatalogoIndirSet(aObjetosABorrar, "D");
              if (oTable.removeSelections) oTable.removeSelections(true);
              MessageToast.show(that.getTranslatedText("catalogoRecursosBorrarOk"));
              await that._loadCatalogoRecursos();
            } catch (error) {
              console.error("[onDeleteRecursoCatalogo]", error);
            }
          }
        });
        //   
      },
      //   
      //  
      onExportCatalogoRecursos: function () {
        MessageToast.show(this.getTranslatedText("workInPregress"));
      },
      //    Importacion del catalogo de recursos (boton Importar del Dialog y del panel
      //  lateral). El FileUploader entrega el fichero seleccionado; se lee como base64 y se
      //  envia a /ImportCatalogoRecursosSet replicando el flujo de "directos". El master no se
      //  serializa en el payload: el backend lo reconstruye a partir del header token (mismo
      //  patron que el resto de llamadas de la app, p.ej. /SelectCatalogoIndirSet o
      //  /MasterSearchSet), por eso NavClase se envia vacio.
      onCatalogoRecursosFileSelected: function (oEvent) {
        var oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
        var oFU = oEvent.getSource();
        if (!oFile) {
          if (oFU && oFU.clear) oFU.clear();
          return;
        }

        var that = this;
        var oReader = new FileReader();
        oReader.onload = function (oLoadEvent) {
          var sResult = (oLoadEvent.target && oLoadEvent.target.result) || "";
          //   readAsDataURL devuelve "data:<mime>;base64,<contenido>"; se aisla el base64.
          var iComma = sResult.indexOf(",");
          var sBase64 = iComma >= 0 ? sResult.substring(iComma + 1) : sResult;
          that._uploadCatalogoRecursos({
            FILE_NAME: oFile.name,
            FILE_TYPE: oFile.type || "",
            FILE_SIZE: String(oFile.size || 0),
            FILE_CONTENTS: sBase64
          });
        };
        oReader.onerror = function () {
          MessageBox.error(that.getTranslatedText("catalogoRecursosFileReadError") || "No se ha podido leer el fichero seleccionado.");
        };
        oReader.readAsDataURL(oFile);

        //   Reset del FileUploader para permitir reseleccionar el mismo fichero despues.
        if (oFU && oFU.clear) oFU.clear();
      },

      onCatalogoRecursosFileTypeMismatch: function () {
        MessageBox.error(this.getTranslatedText("catalogoRecursosFileTypeError") || "Tipo de fichero no soportado. Use xlsx, xls o csv.");
      },

      //    Envia el fichero al backend y refresca el catalogo. Estructura de payload tomada de
      //  la entidad ImportCatalogoRecursos (NavUpload con el fichero; NavClase / NavRecursosCatalogo /
      //  NavChanges / NavMensajes vacios, el backend los devuelve poblados en la respuesta).
      _uploadCatalogoRecursos: async function (oUploadRow) {
        try {
          var oAppData = this.getGlobalModel("appData").getData();
          var oResp = await this.post(
            this.getGlobalModel("mainService"),
            "/ImportCatalogoRecursosSet",
            {
              "NavUpload": [oUploadRow],
              "NavClase": [],
              "NavRecursosCatalogo": [],
              "NavChanges": [],
              "NavMensajes": []
            },
            {
              headers: {
                ambito: oAppData.userData.initialNode,
                token: oAppData.EvToken || "",
                lang: oAppData.userData.AplicationLangu
              }
            }
          );

          //   El modelo OData v2 normalmente desenvuelve "d"; se contempla por si llega crudo.
          var oRespD = (oResp && oResp.d) ? oResp.d : oResp;
          var aMensajes = (oRespD && oRespD.NavMensajes && oRespD.NavMensajes.results) || [];
          var aMensajesError = aMensajes.filter(function (m) { return m.Tipo === "E"; });
          if (aMensajesError.length > 0) {
            this.createMessageDialog({
              title: this.getTranslatedText("ERROR"),
              textAccept: this.getTranslatedText("ACEPTAR"),
              messages: aMensajesError.map(function (m) {
                return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
              })
            });
            return;
          }

          MessageToast.show(this.getTranslatedText("catalogoRecursosImportOk") || "Catálogo importado correctamente");
          //   Se recarga el catalogo para reflejar los recursos importados.
          await this._loadCatalogoRecursos();
        } catch (error) {
          console.error("[_uploadCatalogoRecursos]", error);
          MessageBox.error(this.getTranslatedText("catalogoRecursosImportError") || "Error al importar el catálogo de recursos");
        }
      },

    
     /* onCatalogoRecursosFileSelected: function (oEvent) {
        var oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
        if (!oFile) return;

        var that = this;
        var oReader = new FileReader();
        oReader.onload = function (oLoadEvent) {
          var sResult = oLoadEvent.target.result || "";
          // sResult viene como "data:<mime>;base64,<contenido>". Se aísla solo el base64.
          var iComma = sResult.indexOf(",");
          var sBase64 = iComma >= 0 ? sResult.substring(iComma + 1) : sResult;

          that._uploadCatalogoRecursos({
            FILE_NAME: oFile.name,
            FILE_TYPE: oFile.type || "",
            FILE_SIZE: String(oFile.size || 0),
            FILE_CONTENTS: sBase64
          });
        };
        oReader.onerror = function () {
          MessageBox.error(that.getTranslatedText("catalogoRecursosFileReadError") || "No se ha podido leer el fichero seleccionado.");
        };
        oReader.readAsDataURL(oFile);

        // Reset del FileUploader para permitir reseleccionar el mismo fichero después.
        var oFU = oEvent.getSource();
        if (oFU && oFU.clear) oFU.clear();
      },

      _uploadCatalogoRecursos: async function (oUploadRow) {
        try {
          var oAppData = this.getGlobalModel("appData").getData();
          var response = await this.post(
            this.getGlobalModel("mainService"),
            "/ImpCatalogoIndirectosSet",
            {
              "NavUpload": [oUploadRow],
              "NavMensajes": [],
              "NavIndCatalogo": []
            },
            {
              headers: {
                ambito: oAppData.userData.initialNode,
                lang: oAppData.userData.AplicationLangu
              }
            }
          );

          var aMensajes = (response && response.NavMensajes && response.NavMensajes.results) || [];
          var aMensajesError = aMensajes.filter(function (m) { return m.Tipo === "E"; });
          if (aMensajesError.length > 0) {
            this.createMessageDialog({
              title: this.getTranslatedText("ERROR"),
              textAccept: this.getTranslatedText("ACEPTAR"),
              messages: aMensajesError.map(function (m) {
                return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
              })
            });
            return;
          }

          MessageToast.show(this.getTranslatedText("catalogoRecursosImportOk") || "Importación correcta");
          await this._loadCatalogoRecursos();
        } catch (error) {
          console.error("[_uploadCatalogoRecursos]", error);
          MessageBox.error(this.getTranslatedText("ERROR_AL_IMPORTAR") || "Error al importar el catálogo");
        }
      },*/

     
     /* onExportCatalogoRecursos: function () {
        var oTabBar = this.byId("catalogoRecursosTabBar");
        var sKey = oTabBar ? oTabBar.getSelectedKey() : "obra";
        var oModel = this.getView().getModel("catalogoRecursosModel");
        if (!oModel) return;
        var aData = oModel.getProperty("/" + sKey) || [];

        var sTitle = sKey === "obra"
          ? this.getTranslatedText("catalogoRecursosObra")
          : this.getTranslatedText("catalogoRecursosGenerales");

        var aColumns = [
          { label: this.getTranslatedText("catalogoRecursosIdRecurso"), property: "IdRecurso" },
          { label: this.getTranslatedText("catalogoRecursosPuesto"),    property: "Puesto" },
          { label: this.getTranslatedText("catalogoRecursosTarifa"),    property: "Fee", type: "Number" }
        ];

        sap.ui.require(["sap/ui/export/Spreadsheet"], function (Spreadsheet) {
          var oSheet = new Spreadsheet({
            workbook: { columns: aColumns },
            dataSource: aData,
            fileName: "Catalogo_Recursos_" + sTitle + ".xlsx"
          });
          oSheet.build().finally(function () { oSheet.destroy(); });
        });
      },*/

      /**
       * Se propaga el estado de seleccion de la casilla de ejecutado hacia la vista activa.
       * Se marca ademas la variante activa como modificada en el controlador hijo para
       * habilitar el guardado directo, de forma identica al comportamiento de idAjustesCheckBox.
       */
      onEjecutadoCheckBoxSelect: function (oEvent) {
        const bSelected = oEvent.getParameter("selected");
        const sCurrentKey = this._lastSelectedKey || this.byId("itb").getSelectedKey();
        const oActiveView = this._mViews[sCurrentKey];

        if (!oActiveView) return;

        const oActiveController = oActiveView.getController();

        // Se marca la variante activa como modificada en el controlador hijo activo
        // para que aparezca el asterisco y se habilite el boton de guardado directo.
        if (oActiveController._markVariantDirty) {
          oActiveController._markVariantDirty();
        }

        // Se delega la logica de columnas al controlador hijo con el estado booleano correcto.
        if (oActiveController._handleEjecutado) {
          oActiveController._handleEjecutado(bSelected);
        }
      },

      /**
       * Se gestiona la navegación entre las diferentes pestañas del menú principal.
       */
      onTabSelect: function (oEvent) {
        const sNewKey = oEvent.getParameter("key");
        const oIconTabBar = this.byId("itb");
        const sCurrentKey = this._lastSelectedKey || oIconTabBar.getSelectedKey();

        // Se reinician las columnas al abandonar la vista de "corrientes"
        if (sCurrentKey === "corrientes" && sNewKey !== "corrientes") {
          this._resetCorrientesColumns();
        }
        else if (sCurrentKey === "anticipados" && sNewKey !== "anticipados") {
          this._resetAnticipadosColumns();
        }
        else if (sCurrentKey === "diferidos" && sNewKey !== "diferidos") {
          this._resetDiferidosColumns();
        }
        else if (sCurrentKey === "inmov" && sNewKey !== "inmov") {
          this._resetInmovilizadosColumns();
        }
        
        // Se llama al servicio CambioPestIndirectosSet cuando se navega a dashboard (Inicio)
        // pero solo si no es la primera carga de la aplicación
        if (sNewKey === "dashboard" && this._lastSelectedKey) {
          this._callCambioPestIndirectos();
        }

        /* NO SE ESTA USANDO Se verifica si existen cambios sin guardar antes de abandonar la vista de "corrientes"
        if (sCurrentKey === "corrientes" && this._mViews["corrientes"]) {
          const oCorrientesController = this._mViews["corrientes"].getController();

          if (oCorrientesController.hasUnsavedChanges && oCorrientesController.hasUnsavedChanges()) {
            MessageBox.confirm(this.getTranslatedText("CAMBIOS_SIN_GUARDAR_DESCARTAR"), {
              actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
              onClose: function (oAction) {
                if (oAction === MessageBox.Action.OK) {
                  if (oCorrientesController.resetInputs) {
                    oCorrientesController.resetInputs();
                  }

                  this._lastSelectedKey = sNewKey;
                  this._showView(sNewKey);
                } else {
                  oIconTabBar.setSelectedKey(sCurrentKey);
                }
              }.bind(this)
            });
            return;
          }
        }*/

        this._lastSelectedKey = sNewKey;
        //   Se publica la pestaña activa en el modelo ui para que el sidebar pueda condicionar la visibilidad del botón "Catálogo de recursos"
        this.getView().getModel("ui").setProperty("/activeTab", sNewKey);
        //     Se resetean los filtros y los resultados del panel
        //   "Historico de modificaciones" en cada cambio de pestania: las
        //   operaciones sugeridas dependen de la vista activa (un PhPspnr
        //   I.003.001 de Corrientes no tiene sentido en Anticipados) y los
        //   resultados pertenecen al contexto que el usuario acaba de dejar.
        //   Si el nuevo destino es el dashboard se cierra ademas el panel,
        //   ya que el boton que lo abre se oculta y dejarlo visible romperia
        //   la coherencia visual.
        this._resetHistoryPanel();
        if (sNewKey === "dashboard") {
          var oHistoryBar = this.byId("historySideBar");
          if (oHistoryBar && oHistoryBar.getVisible()) {
            oHistoryBar.setVisible(false);
          }
        }
        //     
        this._showView(sNewKey, sCurrentKey);
      },

      //     Helper que vuelve historyModel a su estado inicial:
      //   filtros vacios, valueState limpios y array de resultados vaciado.
      //   Se invoca desde onTabSelect en cada cambio de pestania. Tambien se
      //   limpia el value del SearchField y los DateTimePicker accediendo a
      //   los controles por id, por si el binding hubiera quedado desincronizado
      //   (caso particular del SearchField que mantiene el texto interno
      //   incluso despues de borrar la propiedad del modelo).
      _resetHistoryPanel: function () {
        var oModel = this.getView().getModel("historyModel");
        if (!oModel) return;
        oModel.setProperty("/filters", {
          operacion: "",
          desde: null,
          hasta: null,
          desdeState: "None",
          desdeStateText: "",
          hastaState: "None",
          hastaStateText: ""
        });
        var oSearch = this.byId("historyOperacionSearch");
        if (oSearch && oSearch.setValue) oSearch.setValue("");
        //   Se invalida tambien el cache de sugerencias para que al cambiar
        //   de vista la lista se recargue con los PhPspnr de la nueva tabla.
        if (oSearch && oSearch.destroySuggestionItems) {
          var oSuggModel = oSearch.getModel("opSugg");
          if (oSuggModel) oSuggModel.setProperty("/items", []);
        }
        //   Se usa setDateValue(null) en lugar de setValue("") porque la
        //   cadena vacia atraviesa el type converter sap.ui.model.type.DateTime
        //   y se interpreta como "anno 0", lo que provocaba que el calendario
        //   se abriera en enero del anno 0001 tras resetear el panel. La
        //   propiedad dateValue (Date interno) admite null y limpia el
        //   control sin pasar por el parser de cadenas.
        var oDesde = this.byId("historyDesdePicker");
        var oHasta = this.byId("historyHastaPicker");
        if (oDesde && oDesde.setDateValue) oDesde.setDateValue(null);
        if (oHasta && oHasta.setDateValue) oHasta.setDateValue(null);
      },
      //     

    _callCambioPestIndirectos: function () {
        var oAppData = this.getGlobalModel("appData").getData();
        var oDashModel = this.getGlobalModel("dashboardModel");
        // Obtener la versión activa
        var versiones = oAppData.NavLtVersiones;
        var flagSelectVersion = versiones.find(function (item) {
          return item.Activo === "X";
        });
        
        // Obtener Freal (ejercicio)
        var sFreal = "";
        if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
          sFreal = oAppData.tramo.Freal;
        } else if (oDashModel) {
          sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
        }
        
        if (!sFreal) {
          return; // No hacer nada si no hay fecha
        }
        
        var oDateStart = this._parseODataDate(sFreal);
        if (!oDateStart || isNaN(oDateStart.getTime())) {
          return; // No hacer nada si la fecha es inválida
        }
        
        var sEjercicio = oDateStart.getFullYear().toString();
        const token = oAppData.EvToken;
        
        var that = this;
        
        this.post(
          this.getGlobalModel("mainService"),
          "/CambioPestIndirectosSet",
          {
            "NavSelProyecto": [oAppData.tramo],
            "NavChanges": [],
            "NavDatosIndirectos": [],
            "NavKpisIndirectos":[],
            //   Se envía en el body el capítulo ya bloqueado por el usuario para que el
            //      backend no intente bloquearlo de nuevo (el header "bloqueado" no es leído
            //      por el back para esta comparación; debe ir en este campo del payload).
            "EvBloqueados": oAppData.EvBloqueados || "",
            "NavMensajes": [],
            "NavLtVersiones": [flagSelectVersion]
          },
          {
            headers: {
              ambito: oAppData.userData.initialNode,
              lang: oAppData.userData.AplicationLangu,
              bloqueado: oAppData.EvBloqueados || "",
              decimales: oDashModel ? oDashModel.getData().decimales : "2",
              ejercicio: sEjercicio,
              pestana: "", // Pestana vacía para dashboard
              token: token
            }
          }
        ).then(function (response) {
          // Capturar el estado de bloqueo de la pestaña desde EvBloqueados
          var sEvBloqueados = response.EvBloqueados || "";
          var bIsBlocked = sEvBloqueados.trim().length > 0;
          that.getGlobalModel("appData").setProperty("/EvBloqueados", sEvBloqueados);
          // Verificar si hay mensajes de error
          var aMensajes = response.NavMensajes?.results || [];
          var aMensajesError = aMensajes.filter(function(mensaje) {
            return mensaje.Tipo === "E";
          });
          
          if (aMensajesError.length > 0) {
            that.createMessageDialog({
              title: that.getTranslatedText("ERROR"),
              textAccept: that.getTranslatedText("ACEPTAR"),
              messages: aMensajesError.map(function(mensaje) {
                return {
                  text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                  type: "Error"
                };
              })
            });
          }
        }).catch(function (error) {
          // Mostrar error si la llamada falla
          console.error("[_callCambioPestIndirectos] Error:", error);
          MessageBox.error(
            that.getTranslatedText("ERROR_SERVICIO") || "Error al llamar al servicio"
          );
        });
      },
      
      /**
       * Parsea una fecha en formato OData
       * @param {string} sODataDate - Fecha en formato OData
       * @returns {Date} Fecha parseada
       * @private
       */
      _parseODataDate: function (sODataDate) {
        if (!sODataDate) return null;
        var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
        if (oMatch) {
          return new Date(parseInt(oMatch[1], 10));
        }
        return new Date(sODataDate);
      },

      /**
       * Se restablecen los elementos visuales específicos de la vista de corrientes.
       */
      _resetCorrientesColumns: function () {
        if (this._mViews["corrientes"]) {
          const oCorrientesController = this._mViews["corrientes"].getController();

          // Se ocultan las columnas dinámicas
          const oColMonths = oCorrientesController.byId("colMonths");
          const oColNew = oCorrientesController.byId("colNew");

          if (oColMonths) oColMonths.setVisible(false);
          if (oColNew) oColNew.setVisible(false);

          // Se restablece el modelo de interfaz de usuario
          const oUiModel = oCorrientesController.getView().getModel("ui");
          if (oUiModel) {
            oUiModel.setProperty("/showStickyParent", false);
            oUiModel.setProperty("/showStickyChild", false);
          }
        }
      },

      /**
       * Se restablecen los elementos visuales específicos de la vista de diferidos.
       */
      _resetDiferidosColumns: function () {
        if (this._mViews["diferidos"]) {
          const oCorrientesController = this._mViews["diferidos"].getController();

          // Se ocultan las columnas dinámicas
          const oColMonths = oCorrientesController.byId("colMonths");
          const oColNew = oCorrientesController.byId("colNew");

          if (oColMonths) oColMonths.setVisible(false);
          if (oColNew) oColNew.setVisible(false);

          // Se restablece el modelo de interfaz de usuario
          const oUiModel = oCorrientesController.getView().getModel("ui");
          if (oUiModel) {
            oUiModel.setProperty("/showStickyParent", false);
            oUiModel.setProperty("/showStickyChild", false);
          }
        }
      },

      /**
       * Se restablecen los elementos visuales específicos de la vista de inmovilizados.
       */
      _resetInmovilizadosColumns: function () {
        if (this._mViews["inmov"]) {
          const oCorrientesController = this._mViews["inmov"].getController();

          // Se ocultan las columnas dinámicas
          const oColMonths = oCorrientesController.byId("colMonths");
          const oColNew = oCorrientesController.byId("colNew");

          if (oColMonths) oColMonths.setVisible(false);
          if (oColNew) oColNew.setVisible(false);

          // Se restablece el modelo de interfaz de usuario
          const oUiModel = oCorrientesController.getView().getModel("ui");
          if (oUiModel) {
            oUiModel.setProperty("/showStickyParent", false);
            oUiModel.setProperty("/showStickyChild", false);
          }
        }
      },

      /**
       * Se restablecen los elementos visuales específicos de la vista de anticipados.
       */
      _resetAnticipadosColumns: function () {
        if (this._mViews["anticipados"]) {
          const oCorrientesController = this._mViews["anticipados"].getController();

          // Se ocultan las columnas dinámicas
          const oColMonths = oCorrientesController.byId("colMonths");
          const oColNew = oCorrientesController.byId("colNew");

          if (oColMonths) oColMonths.setVisible(false);
          if (oColNew) oColNew.setVisible(false);

          // Se restablece el modelo de interfaz de usuario
          const oUiModel = oCorrientesController.getView().getModel("ui");
          if (oUiModel) {
            oUiModel.setProperty("/showStickyParent", false);
            oUiModel.setProperty("/showStickyChild", false);
          }
        }
      },
      /**
       * Se inyecta dinamicamente la vista seleccionada en el contenedor de contenido.
       * Se utiliza una cache interna (_mViews) para no volver a instanciar vistas ya creadas.
       * Se asigna ademas una retrollamada al controlador hijo para que pueda actualizar
       * visualmente el checkbox idEjecutadoCheckBox2 que reside en la Main view.
       */
      _showView: async function (sKey, sPreviousKey) {
        const oContainer = this.byId("tabContent");
        oContainer.removeAllItems();
        const oComp = this.getOwnerComponent();

        if (!this._mViews[sKey]) {
          this._mViews[sKey] = await oComp.runAsOwner(() =>
            sap.ui.xmlview({
              height: "100%",
              layoutData: new sap.m.FlexItemData({ growFactor: 1 }),
              viewName: "zindirect_costs.view.DetailsViews." + this._mapKeyToView(sKey),
            })
          );

          const oNewController = this._mViews[sKey].getController();
          if (oNewController) {
            oNewController._previousTabKey = sPreviousKey;
          }
        }

        oContainer.addItem(this._mViews[sKey]);

        const oActiveController = this._mViews[sKey].getController();
      
        if (oActiveController && sKey !== sPreviousKey) {
          if (sKey === "anticipados" && typeof oActiveController.initAnticipadosModel === "function") {
            await oActiveController.initAnticipadosModel(sPreviousKey);
          } else if (sKey === "diferidos" && typeof oActiveController.initDiferidosModel === "function") {
            await oActiveController.initDiferidosModel(sPreviousKey);
          } else if (sKey === "inmov" && typeof oActiveController.initInmovilizadosModel === "function") {
            await oActiveController.initInmovilizadosModel(sPreviousKey);
          } else if (sKey === "corrientes" && oActiveController._bViewAlreadyRendered === true && typeof oActiveController.initCorrienteModel === "function") {
   
            var aCustomSnapshot = typeof oActiveController._snapshotCustomBlocks === "function"
              ? oActiveController._snapshotCustomBlocks()
              : [];
            await oActiveController.initCorrienteModel(sPreviousKey);
            if (aCustomSnapshot && aCustomSnapshot.length > 0
                && typeof oActiveController._restoreCustomBlocks === "function") {
              oActiveController._restoreCustomBlocks(aCustomSnapshot);
            }
          } else if (sKey === "externos" && oActiveController._bViewAlreadyRendered === true && typeof oActiveController.initExternosModel === "function") {
            await oActiveController.initExternosModel(sPreviousKey);
          }
        }
   
        
        // Se marca que la vista ya se ha renderizado al menos una vez
        if (oActiveController) {
          oActiveController._bViewAlreadyRendered = true;
        }

        // Se asigna una retrollamada al controlador hijo para que pueda actualizar
        // visualmente el checkbox idEjecutadoCheckBox2 que reside en la Main view,
        // ya que el hijo no tiene acceso directo a los controles de esta vista padre.
        const oCheckBoxRef = this.byId("idEjecutadoCheckBox2");
        if (oActiveController) {
          oActiveController._fnSetEjecutadoCheckBox = function (bSelected) {
            if (oCheckBoxRef) {
              oCheckBoxRef.setSelected(bSelected);
            }
          };
        }

        // Se sincroniza siempre el estado del checkbox con la vista activa al renderizar.
        if (oCheckBoxRef && oActiveController && oActiveController._handleEjecutado) {
          setTimeout(function () {
            oActiveController._handleEjecutado(oCheckBoxRef.getSelected());
          }, 100);
        }
      },

      /**
       * Se mapean las claves de las pestañas con los nombres físicos de las vistas XML correspondientes.
       */
      _mapKeyToView: function (sKey) {
        return {
          dashboard: "Dashboard",
          anticipados: "Anticipados",
          diferidos: "Diferidos",
          corrientes: "Corrientes",
          inmov: "Inmovilizados",
          externos: "Externos",
        }[sKey];
      },
       _ensureChapterLoadedForExport: async function (sKey) {
        //     Mapeo clave → método init del controller (los nombres no son uniformes entre capítulos)
        const oInitMethodByKey = {
          "anticipados": "initAnticipadosModel",
          "inmov": "initInmovilizadosModel",
          "corrientes": "initCorrienteModel",
          "diferidos": "initDiferidosModel",
          "externos": "initExternosModel"
        };
        //     1. Crear la vista si no existe. Importante: para que las columnas declaradas en el
        //   XML estén en la agregación ANTES de que onInit añada columnas dinámicas, hay que esperar a
        //   que el XML termine de parsearse. Sin ese await, setupDynamicTreeTable/createDynamicYearColumns
        //   añaden las dinámicas a una agregación vacía, y al renderizar después el XML las estáticas
        //   se intercalan en orden incorrecto (visible al exportar y luego clicar la pestaña).
        let bViewJustCreated = false;
        if (!this._mViews[sKey]) {
          const oComp = this.getOwnerComponent();
          const oView = await oComp.runAsOwner(() =>
            sap.ui.xmlview({
              height: "100%",
              viewName: "zindirect_costs.view.DetailsViews." + this._mapKeyToView(sKey)
            })
          );
          //     Se espera a que el parser de XMLView complete antes de seguir. .loaded() resuelve
          //   cuando todas las columnas declaradas estáticamente ya están en la agregación.
          if (oView && typeof oView.loaded === "function") {
            await oView.loaded();
          }
          this._mViews[sKey] = oView;
          bViewJustCreated = true;
        }
        const oController = this._mViews[sKey].getController();
        if (!oController) {
          return null;
        }
        //     2. Si la vista se acaba de crear, esperar a que onInit/setInitData del controller
        //   terminen. La señal de "init completado" es que tableModelName esté definido (se asigna
        //   AL FINAL de setInitData en Corrientes/Externos, e inmediatamente en Anticipados/Diferidos/
        //   Inmovilizados). Poll cada 100ms hasta 8s para no bloquear indefinidamente.
        if (bViewJustCreated) {
          const iMaxWait = 8000;
          const iPollInterval = 100;
          let iWaited = 0;
          while (!oController.tableModelName && iWaited < iMaxWait) {
            await new Promise(function (r) { setTimeout(r, iPollInterval); });
            iWaited += iPollInterval;
          }
        }
        //    
        //     3. Verificar si el modelo ya tiene datos. tableModelName se declara en cada controller
        //   (corrientesModel, externosModel, anticipadosModel, diferidosModel, inmovilizadosModel).
        const sModelName = oController.tableModelName;
        const oModel = sModelName ? this._mViews[sKey].getModel(sModelName) : null;
        const aData = oModel ? oModel.getProperty("/") : null;
        const bHasData = Array.isArray(aData) && aData.length > 0;
        if (bHasData) {
          return oController;
        }
        //     4. Si después de esperar el modelo sigue vacío, intentar cargar datos explícitamente
        //   llamando al método init específico del capítulo (idempotente para todos los capítulos).
        const sInitMethod = oInitMethodByKey[sKey];
        if (sInitMethod && typeof oController[sInitMethod] === "function") {
          await oController[sInitMethod]();
        }
        return oController;
      },

      /**
       * Se recuperan los alcances (scopes) asignados al usuario de manera asíncrona.
       */
      getUserScopes: async function () {
        const appData = this.getGlobalModel("appData").getData();
        const sUrl = this.getEndpointData().urlInsite;

        return this.callExternalService(sUrl + "/security/userScopes", "GET", {
          loadAll: false,
          idUser: appData.userData.idUser,
          applicationCode: "FIDE",
          onlyStandard: false,
          idLanguage: appData.userData.AplicationLangu,
          erpNode: ""
        }).then(async function (response) {
          return {
            children: response.userNodeList
          };
        }.bind(this));
      },

      /**
       * Se abre el diálogo de selección de alcance y se gestiona la actualización de los modelos globales.
       */
      openScopeSelector: async function () {
        const userScopes = await this.getUserScopes();
        this.setGlobalModel(new JSONModel(userScopes), "scopeSelectorModel");

        const allTramos = await this.getTramosByObra();
        this.setGlobalModel(new JSONModel(allTramos.NavTramosProy.results), "allTramosModel");

        if (!this.oScopeSelectorView) {
          const oComp = this.getOwnerComponent();
          this.oScopeSelectorView = await oComp.runAsOwner(() =>
            sap.ui.core.mvc.XMLView.create({
              viewName: "zindirect_costs.view.DialogsViews.ScopeSelector",
              viewData: {
                callback: async function (oSelectedScope, tramoSelected) {

                  // Se actualiza el modelo de alcance global con la nueva selección.
                  if (oSelectedScope) {
                    this.getGlobalModel("appData").setProperty("/userData/initialNode", oSelectedScope.profitCenter);
                    this.getGlobalModel("appData").setProperty("/userData/descriptionNode", oSelectedScope.profitCenterDescription);
                  }

                  // Se actualiza el tramo seleccionado basándose en la elección del usuario.
                  if (tramoSelected) {
                    delete tramoSelected.__metadata;
                    this.getGlobalModel("appData").setProperty("/tramo", tramoSelected);
                  } else {
                    // Si no existe un tramo específico, se busca el tramo por defecto.
                    const tramosModel = this.getGlobalModel("allTramosModel");
                    let defaultTramo = null;
                    defaultTramo = tramosModel
                      .getData()
                      .filter(
                        (tramo) => tramo.Prctr === oSelectedScope.profitCenter,
                      )[0];
                    if (defaultTramo) {
                      delete defaultTramo.__metadata;
                      this.getGlobalModel("appData").setProperty("/tramo", defaultTramo);
                    }
                  }

                  // Si se ha seleccionado una obra específica, se actualiza la norma en el modelo correspondiente.
                  const tramosByObra = await this.getTramosByObra(oSelectedScope.profitCenter);
                  if (tramosByObra.NavTramosDatos.results.length > 0 && !tramosByObra.NavTramosDatos.results[0].Error) {
                    const norm = tramosByObra.NavTramosDatos.results[0].Norma;
                    if(!this.getGlobalModel("normModel")){
                      const normModel = new JSONModel({
                        norma: norm
                      });
                      this.setGlobalModel(normModel, "normModel");
                    }
                    else
                      this.getGlobalModel("normModel").setProperty("/norma", norm);
                  } else if (!!tramosByObra.NavTramosDatos.results[0].Error) {
                    this.getGlobalModel("normModel").setProperty("/norma", "");
                    this.createMessageDialog({
                      title: this.getTranslatedText("ERROR"),
                      textAccept: this.getTranslatedText("ACEPTAR"),
                      messages: [{
                        text: tramosByObra.NavTramosDatos.results[0].Error,
                        type: "Error",
                        showIcon: false,
                        onAccept: function () { },
                      }]
                    });
                  }
                  this.setUserScopeData();
                  this._showView("dashboard",this._lastSelectedKey);
                  this.byId("itb").setSelectedKey("dashboard")
                }.bind(this),
                cancel: function () { },
                close: function () {
                  this._oScopeSelectorDialog.close();
                  this._oScopeSelectorDialog.destroy();
                  this.oScopeSelectorView = null;
                }.bind(this),
              },
            }),
          );

          this._oScopeSelectorDialog = this.oScopeSelectorView.getContent()[0];
          this.getView().addDependent(this.oScopeSelectorView);
        }

        this._oScopeSelectorDialog.open();
      },

      /**
  * Se configura la informacion de usuario y se actualizan los datos de las vistas cacheadas.
  * Se garantiza que el dashboardModel se actualice siempre en primer lugar, ya que otras
  * vistas como corrientes dependen de sus datos para calcular rangos de anos y columnas.
  */
      setUserScopeData: async function () {
        // Se obtienen los datos globales de la aplicacion y la configuracion del usuario activo.
        const appData = this.getGlobalModel("appData").getData();
        const userConfig = appData.userData;

        // Se llama al servicio externo del menu principal con el nodo recien seleccionado.
        await this.callExternalService(this.getEndpointData().urlInsite + "/menu/mainMenu", "GET", {
          idUser: userConfig.idUser,
          loginUser: userConfig.User,
          idLanguageApp: userConfig.AplicationLangu,
          idLanguage: userConfig.Langu,
          erpNode: userConfig.initialNode,
          erpCountry: null,
          erpRegion: null,
          idHierarchy: "FERR",
          idApplication: "FIDE"
        });

        // Se obtiene la clave de la pestana activa en este momento.
        const oIconTabBar = this.getView().byId("itb");
        const currentKey = oIconTabBar.getSelectedKey();

        // Se actualiza siempre el dashboard en primer lugar, independientemente de la pestana activa.
        // Esto es obligatorio porque el dashboardModel con las fechas Freal y Frealfinobra del nuevo
        // tramo es leido por corrientes en _initYearsModel para calcular el rango de columnas anuales.
        const oDashboardView = this._mViews["dashboard"];
        if (oDashboardView && oDashboardView.getController().setInitData) {
          await oDashboardView.getController().setInitData();
        }

        // Se actualiza la vista activa si no es el dashboard que ya fue actualizado arriba.
        if (currentKey !== "dashboard") {
          const currentView = this._mViews[currentKey];
          if (currentView && currentView.getController().setInitData) {
            await currentView.getController().setInitData();
          }
        }

        // Se registra el tramo que se esta cargando para facilitar el diagnostico.
        console.log("[setUserScopeData] Actualizando corrientes para tramo:",
          this.getGlobalModel("appData").getData().tramo.Prctr);

       
        if (currentKey !== "corrientes" && this._mViews["corrientes"]) {
          const oCorrientesController = this._mViews["corrientes"].getController();
          if (oCorrientesController && oCorrientesController.initCorrienteModel) {
            await oCorrientesController.initCorrienteModel();
          }
        }
        
      },


      /**
       * Se actualiza el modelo que controla la visibilidad global de las columnas ejecutadas.
       */
      onMainEjecutadoToggle: function (oEvent) {
        const bSelected = oEvent.getParameter("selected");
        this.getView().getModel("visibleColumn").setProperty("/visible", bSelected);
      },
            onSelectAplicacion: function (oEvent) {
        // Se obtiene el ComboBox que dispara el evento: en sap.m.ComboBox el parametro
        // "selectedItem" NO esta presente en el evento change (los parametros son "value"
        // y "itemPressed"), por lo que se accede al item seleccionado via getSource().
        var oComboBox = oEvent.getSource();
        // Se obtiene la clave actualmente seleccionada (directos / indirectos).
        var sKey = oComboBox.getSelectedKey();
        // Se ignora la seleccion "indirectos" porque coincide con la app actualmente abierta.
        if (sKey !== "directos") { return; }

        // Se obtiene el dominio del navegador para determinar el entorno (DESA/TEST/PRO).
        var sHost = (window.location && window.location.hostname) || document.domain || "";
        // Se declara la variable que contendra la URL destino de la app de Directos.
        var sUrlDirectos;
        // Se declara la variable que identifica el nombre del entorno detectado, para depuracion en local.
        var sEntorno;

        // Se mapea el dominio actual al entorno correspondiente, replicando los hosts ya
        // utilizados en webapp/model/models.js para mantener un unico criterio de entorno.
        if (
          sHost === "fsapl09l.ferrovial.int" ||
          sHost === "fsapl09l.intranet.ferrovial.es"
        ) {
          // Se navega al entorno de Desarrollo conservando el parametro sap-client requerido.
          sEntorno = "DESA";
          sUrlDirectos = "http://fsapl09l.ferrovial.int:8000/sap/bc/ui5_ui5/sap/zui5master/index.html?sap-client=100";
        } else if (sHost === "corporaciontest.ferrovial.int") {
          // Se navega al entorno de Test.
          sEntorno = "TEST";
          sUrlDirectos = "https://corporaciontest.ferrovial.int/sap/bc/ui5_ui5/sap/zui5master/index.html";
        } else if (sHost === "corporacion.ferrovial.int") {
          // Se navega al entorno Productivo.
          sEntorno = "PRO";
          sUrlDirectos = "https://corporacion.ferrovial.int/sap/bc/ui5_ui5/sap/zui5master/index.html";
        } else {
          // Se identifica como ejecucion en LOCAL para cualquier otro host (incluido "localhost").
          // Se reutiliza la URL real de DESA porque desde la red Ferrovial / VPN es alcanzable
          // tambien desde localhost, permitiendo probar la navegacion real sin necesidad de mock.
          sEntorno = "LOCAL";
          sUrlDirectos = "http://fsapl09l.ferrovial.int:8000/sap/bc/ui5_ui5/sap/zui5master/index.html?sap-client=100";
        }

        // Se diferencia el modo de navegacion segun el entorno:
        // - En LOCAL se abre la app de Directos en una pestanya nueva (_blank) para no perder la
        //   sesion del dev server que el desarrollador esta usando para trabajar.
        // -    en DESA y TEST se pasa tambien a abrir en pestanya nueva (_blank), antes se hacia window.location.href con lo que la pagina actual era reemplazada por la de Directos y se perdia el contexto de Indirectos: el usuario tenia que recargar para volver. En PRO el flujo entra normalmente desde Fiori Launchpad y la apertura se gestiona arriba, por lo que se mantiene window.location.href para no introducir regresiones (un cambio a _blank ahi podria provocar pestanyas duplicadas o bloqueo de popups segun la politica del navegador del usuario PRO)  
        // - En PRO se sustituye la pagina actual (comportamiento estandar) porque las dos apps
        //   conviven en el mismo servidor SAP y no hay sesion local que preservar.
        if (sEntorno === "LOCAL" || sEntorno === "DESA" || sEntorno === "TEST") {
          window.open(sUrlDirectos, "_blank");
        } else {
          window.location.href = sUrlDirectos;
        }
      },
      /**
       * Se gestiona el cambio de versión seleccionada por el usuario.
       * Se actualiza el modelo global para reflejar la nueva versión activa y se fuerza
       * la reinicialización de los datos en la pestaña visible actualmente.
       */
      onSelectVersion: function (oEvent) {
        // Se obtiene la referencia al modelo global de datos de la aplicación.
        var oAppDataModel = this.getGlobalModel("appData");

        // Se recupera la clave de la versión que acaba de ser seleccionada.
        var sSelectedKey = oAppDataModel.getProperty("/sVersionActiva");

        // Se extrae el arreglo con el listado completo de versiones disponibles.
        var aVersiones = oAppDataModel.getProperty("/NavLtVersiones") || [];

        // Se recorre el arreglo completo para limpiar el estado activo de todas las versiones previas.
        aVersiones.forEach(function (item) {
          item.Activo = "";
        });

        // Se busca el objeto específico que corresponde a la nueva versión seleccionada.
        var oVersionEncontrada = aVersiones.find(function (item) {
          return item.Version === sSelectedKey;
        });

        // Se marca la versión encontrada como la actual activa mediante el indicador "X".
        oVersionEncontrada.Activo = "X";

        // Se localiza el control contenedor de pestañas (IconTabBar) de la vista principal.
        const oIconTabBar = this.getView().byId("itb");

        // Se determina cuál es la clave de la pestaña que el usuario está viendo en este momento.
        const currentKey = oIconTabBar.getSelectedKey();

        // Se recupera la instancia de la vista anidada correspondiente a dicha pestaña.
        const currentView = this._mViews[currentKey];

        // Se comprueba si la vista interna y su controlador disponen de la función de inicialización,
        // y de ser así, se ejecuta para que recargue los datos usando la nueva versión activa.
        if (currentView && currentView.getController().setInitData) {
          currentView.getController().setInitData();
        }
      },

      /**
       * Se gestiona el guardado manual de los datos de costes indirectos.
       * Se envía la información del proyecto y versiones al backend mediante el endpoint GuardarIndirectosSet.
       */
      onSave: async function (sEjercicioOverride) {
        try {
          // Se obtiene el modelo global con los datos de la aplicación
          const oAppDataModel = this.getGlobalModel("appData");
          const oAppData = oAppDataModel.getData();

          // Se obtiene el modelo del dashboard para acceder a decimales y bloqueado
          const oDashboardModel = this.getGlobalModel("dashboardModel");
          const oDashboardData = oDashboardModel ? oDashboardModel.getData() : {};

          //   Mapeo de la clave del IconTabBar al texto largo que espera el backend
          // en el header "pestana", alineado con el patron usado en _enviarFilaAlBackend
          // y los _callDelIndirectosService de cada detail controller.
          const oTabKeyToPestana = {
            corrientes: "Corrientes",
            externos: "Externos",
            anticipados: "Anticipados",
            diferidos: "Diferidos",
            inmov: "Inmovilizados"
          };
          const oIconTabBar = this.byId("itb");
          const sTabKey = oIconTabBar ? oIconTabBar.getSelectedKey() : "";
          const sPestana = oTabKeyToPestana[sTabKey] || "";

          //   Ejercicio: prioridad al selector de anio de la pestana activa
          // (yearsModel/selectedYear vive en la view detalle, no en Main, asi que se
          // lee atravesando _mViews). Fallback: anio de Freal del tramo o del dashboard.
          // Mismo orden que aplican los detail controllers en _CambioPestIndirectosSet.
          let sEjercicio = "";
          const oActiveView = this._mViews && this._mViews[sTabKey];
          //   Si se recibe un ejercicio explicito (p.ej. desde onYearChange, que necesita
          //   guardar con el anio ANTERIOR al recien seleccionado porque el binding del
          //   Select ya actualizo /selectedYear) tiene prioridad sobre la lectura del modelo.
          //   Se valida que sea un valor de anio primitivo: cuando onSave se dispara desde el
          //   boton "Guardar" (press="onSave") el primer argumento es el oEvent del control,
          //   que NO debe interpretarse como ejercicio.
          if ((typeof sEjercicioOverride === "string" || typeof sEjercicioOverride === "number") &&
              String(sEjercicioOverride).trim() !== "") {
            sEjercicio = String(sEjercicioOverride).trim();
          }
          if (!sEjercicio && oActiveView) {
            const oYearsModel = oActiveView.getModel("yearsModel");
            const sSelectedYear = oYearsModel && oYearsModel.getProperty("/selectedYear");
            if (sSelectedYear) {
              sEjercicio = String(sSelectedYear);
            }
          }
          if (!sEjercicio) {
            let sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
              sFreal = oAppData.tramo.Freal;
            } else if (oDashboardModel) {
              sFreal = oDashboardModel.getProperty("/NavMasterLt/0/Freal");
            }
            const oFrealDate = this._parseODataDate(sFreal);
            if (oFrealDate && !isNaN(oFrealDate.getTime())) {
              sEjercicio = oFrealDate.getFullYear().toString();
            }
          }

          // Se prepara el objeto de datos para enviar al backend
          const oPayload = {
            // Se incluye la información del proyecto seleccionado
            NavSelProyecto: oAppData.tramo ? [oAppData.tramo] : [],
            // Se incluye la lista completa de versiones disponibles
            NavLtVersiones: oAppData.NavLtVersiones || []
          };

        
          const oParams = {
            headers: {
              ambito: (oAppData.userData && oAppData.userData.initialNode) || "",
              lang: (oAppData.userData && oAppData.userData.AplicationLangu) || "",
              bloqueado: oAppData.EvBloqueados || "",
              decimales: oDashboardData.decimales || "02",
              ejercicio: sEjercicio,
              pestana: sPestana
            }
          };

          // Se realiza la llamada al servicio de guardado
          var oSaveResponse = await this.post(
            this.getGlobalModel("mainService"),
            "/GuardarIndirectosSet",
            oPayload,
            oParams
          );

          // Se muestran los mensajes devueltos por el backend en el MessagePopover.
          // Si NavMensajes viene vacío se genera un mensaje de éxito genérico.
          var oSaveResp = (oSaveResponse && oSaveResponse.d) ? oSaveResponse.d : oSaveResponse;
          var aMensajesResp = (oSaveResp && oSaveResp.NavMensajes && oSaveResp.NavMensajes.results) || [];
          if (aMensajesResp.length > 0) {
            this.showMessageInMessageView(aMensajesResp, true);
          } else {
            var sOkMsg = this.getTranslatedText("DATOS_GUARDADOS_CORRECTAMENTE") || "Datos guardados correctamente";
            this.showMessageInMessageView([{ Tipo: "S", Mensaje: sOkMsg }], true);
          }
  // (INICIO)
          //   Tras un guardado definitivo correcto se limpia el flag _hasPendingChanges
          //   del controller de la vista detalle activa: ya no hay cambios pendientes en
          //   backend, asi que un siguiente cambio de anio (o un nuevo click en Guardar)
          //   sin edicion intermedia NO disparara una llamada redundante a este servicio.
          if (oActiveView) { //   solo si la vista activa esta resuelta
              var oActiveControllerMV = oActiveView.getController(); //   se accede a su controller
              if (oActiveControllerMV) { //   defensivo: el controller puede no estar listo en arranque
                  oActiveControllerMV._hasPendingChanges = false; //   cambios consolidados, flag a false
              }
          }
          // (FIN)

        } catch (error) {
          // Se captura y muestra cualquier error que ocurra durante el proceso
          var sErrMsg = this.getTranslatedText("ERROR_AL_GUARDAR") || ("Error al guardar los datos: " + (error && error.message));
          this.showMessageInMessageView([{ Tipo: "E", Mensaje: sErrMsg }], true);
          console.error("[onSave] Error al guardar:", error);
        }
      },

      /**
       * Se abre el diálogo de configuración de usuario.
       * Se cachea el fragment para no recrearlo en cada apertura.
       */
      onUserConfigOpen: async function (oEvent) {
        if (!this._oUserConfigDialog) {
          this._oUserConfigDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "zindirect_costs.fragments.UserConfigDialog",
            controller: this
          });
          this.getView().addDependent(this._oUserConfigDialog);
        }
        // Se guarda una copia de los valores actuales para poder restaurarlos en caso de cancelación
        const oUserData = this.getGlobalModel("appData").getProperty("/userData");
        this._oUserConfigSnapshot = {
          AplicationLangu: oUserData.AplicationLangu,
          UserLangu: oUserData.UserLangu,
          DateFormat: oUserData.DateFormat,
          CurrencyFormat: oUserData.CurrencyFormat
        };
        this._oUserConfigDialog.open();
      },

      /**
       * Se confirman los cambios de configuración de usuario, se persisten en el backend
       * mediante el servicio Insite y se cierra el diálogo.
       */
      onUserConfigSave: async function () {
        try {
          const oAppDataModel = this.getGlobalModel("appData");
          const oUserData = oAppDataModel.getProperty("/userData");

          // Se obtiene el userParameters original cargado al inicio (contiene referencias a entidades
          // Hibernate como tgentimezone que son obligatorias y no debemos omitir).
          // Se sobreescriben únicamente los 4 campos editables por el usuario.
          const oOriginalUserParameters = oAppDataModel.getProperty("/userParameters") || {};
          const dataModel = Object.assign({}, oOriginalUserParameters, {
            idAppLanguage: oUserData.AplicationLangu,
            idlanguage: oUserData.UserLangu,
            dateFormat: oUserData.DateFormat,
            currencyFormat: oUserData.CurrencyFormat
          });

          const sUrl = this.getEndpointData().urlInsite;

          const oPayload = {
            userParameters: dataModel,
            headerVO: {
              pagingVO: {
                resultsPerPage: 50,
                pageNumber: 1,
                totalPages: null,
                totalResults: null
              },
              idUser: oUserData.idUser,
              applicationCode: "FIDE",
              idLanguage: dataModel.idlanguage,
              loginUser: oUserData.User,
              idLanguageApp: dataModel.idAppLanguage,
              callFromController: true,
              erpnode: oUserData.initialNode
            }
          };

          await this.callExternalService(
            sUrl + "/configuration/saveorupdateUserParameters",
            "POST",
            JSON.stringify(oPayload),
            { "Content-Type": "application/json" }
          );

          //   Se persiste el idioma de UI seleccionado en localStorage
          // antes del reload para que Component.js lo aplique con setLanguage
          // antes de crear el ResourceModel y cargue el bundle correcto. Se
          // mapean los codigos del backend (ES/EN/FR, S/E/F, ESP/ENG/FRA, etc.)
          // a los locales UI5 soportados (es/en/fr).  
          try {
            var sUiLang = this._resolveUiLanguage(dataModel.idAppLanguage);
            if (sUiLang && window.localStorage) {
              window.localStorage.setItem("zindirect_costs_app_lang", sUiLang);
            }
          } catch (e) {
            // Se ignora silenciosamente: el cambio surtira efecto solo si el
            // backend persiste la preferencia o el usuario reabre la sesion.
          }
          //  

          this._oUserConfigDialog.close();
          // Se recarga la aplicación para que los nuevos ajustes de idioma y formato surtan efecto.
          location.reload();
        } catch (error) {
          console.error("[onUserConfigSave] Error al guardar configuración:", error);
          sap.m.MessageBox.error(
            this.getTranslatedText("ERROR_AL_GUARDAR") || "Error al guardar la configuración de usuario"
          );
        }
      },

      /**
       *   Se normaliza el codigo de idioma recibido del backend
       * (NavLoadLang.Langu) al locale UI5 soportado por la app. Se cubren
       * las variantes mas comunes en SAP (codigos de 1 letra S/E/F, de 2
       * letras ES/EN/FR y de 3 letras ESP/ENG/FRA), tags BCP-47
       * (es-ES / en-US / fr-FR) y se compara en minusculas para tolerar
       * inconsistencias. Si no se reconoce, se devuelve null y se deja
       * actuar al fallback declarado en manifest.json.  
       * @param {string} sCode codigo de idioma proveniente del backend
       * @returns {string|null} "es" | "en" | "fr" | null
       */
      _resolveUiLanguage: function (sCode) {
        if (!sCode) { return null; }
        var s = String(sCode).trim().toLowerCase();
        if (s === "es" || s === "s" || s === "esp" || s.indexOf("es-") === 0 || s === "spanish") {
          return "es";
        }
        if (s === "en" || s === "e" || s === "eng" || s.indexOf("en-") === 0 || s === "english") {
          return "en";
        }
        if (s === "fr" || s === "f" || s === "fra" || s.indexOf("fr-") === 0 || s === "french") {
          return "fr";
        }
        return null;
      },
      //  

      /**
       * Se abre el diálogo de búsqueda y selección de master.
       * Se destruye y recrea la vista en cada apertura para reflejar siempre
       * las opciones más actuales (masterOfic, lastCh) del modelo global.
       *
       * - masterOfic: lista de masters oficiales disponibles, obtenida del dashboardModel
       *   (NavMasterLt.results). El controlador del diálogo la usa para construir
       *   el selector de ejercicios y el de periodos.
       * - lastCh: carácter inicial de la versión activa (p. ej. "F" para versiones "MA","MO","MP")
       *   que filtra qué masters oficiales se muestran en el selector de ejercicios.
       */
      onSearchMaster: async function () {
        try {
          // Destruir instancia previa para garantizar opciones frescas
          if (this._oCambiarMasterDialog) {
            this._oCambiarMasterDialog.close();
            this._oCambiarMasterDialog.destroy();
            this._oCambiarMasterDialog = null;
          }
          if (this.oCambiarMasterView) {
            this.oCambiarMasterView.destroy();
            this.oCambiarMasterView = null;
          }

          // Obtener datos necesarios para las opciones del diálogo
          var oAppData = this.getGlobalModel("appData") ? this.getGlobalModel("appData").getData() : {};
          var oDashModel = this.getGlobalModel("dashboardModel");
          var aMasterOfic = (oDashModel && oDashModel.getProperty("/NavMasterLt")) || [];
          if (aMasterOfic && aMasterOfic.results) {
            aMasterOfic = aMasterOfic.results;
          }

          // lastCh: primer carácter de la versión activa (si existe)
          var aVersiones = oAppData.NavLtVersiones || [];
          var oVersionActiva = aVersiones.find(function (v) { return v.Activo === "X"; });
          var sLastCh = oVersionActiva && oVersionActiva.Version ? oVersionActiva.Version.substr(0, 1) : "";

          const oComp = this.getOwnerComponent();
          this.oCambiarMasterView = await oComp.runAsOwner(() =>
            sap.ui.core.mvc.XMLView.create({
              viewName: "zindirect_costs.view.DialogsViews.CambiarMaster",
              viewData: {
                // Opciones que el controlador del diálogo lee en onAfterRendering
                options: {
                  masterOfic: aMasterOfic,
                  lastCh: sLastCh,
                  globalData: oAppData
                },
                onAccept: function (oSelectedMaster) {
                  // Se guarda el master seleccionado en appData y se notifica
                  // a las vistas activas para que recarguen con el nuevo master
                  if (oSelectedMaster) {
                    var oAppDataModel = this.getGlobalModel("appData");
                    if (oAppDataModel) {
                      oAppDataModel.setProperty("/masterSeleccionado", oSelectedMaster);
                    }
                  }
                }.bind(this),
                close: function () {
                  if (this._oCambiarMasterDialog) {
                    this._oCambiarMasterDialog.close();
                    this._oCambiarMasterDialog.destroy();
                    this._oCambiarMasterDialog = null;
                  }
                  if (this.oCambiarMasterView) {
                    this.oCambiarMasterView.destroy();
                    this.oCambiarMasterView = null;
                  }
                }.bind(this)
              }
            })
          );

          this._oCambiarMasterDialog = this.oCambiarMasterView.getContent()[0];
          this.getView().addDependent(this.oCambiarMasterView);
          this._oCambiarMasterDialog.open();

        } catch (error) {
          console.error("[onSearchMaster] Error al abrir el diálogo de master:", error);
          MessageBox.error(
            this.getTranslatedText("ERROR") + ": " + (error.message || error)
          );
        }
      },

      /**
       * Se cancela la edición de configuración de usuario, restaurando los valores previos.
       */
      onUserConfigClose: function () {
        if (this._oUserConfigSnapshot) {
          const oAppDataModel = this.getGlobalModel("appData");
          oAppDataModel.setProperty("/userData/AplicationLangu", this._oUserConfigSnapshot.AplicationLangu);
          oAppDataModel.setProperty("/userData/UserLangu", this._oUserConfigSnapshot.UserLangu);
          oAppDataModel.setProperty("/userData/DateFormat", this._oUserConfigSnapshot.DateFormat);
          oAppDataModel.setProperty("/userData/CurrencyFormat", this._oUserConfigSnapshot.CurrencyFormat);
        }
        this._oUserConfigDialog.close();
      }


    });
  }
);