sap.ui.define(
  [
    "masterindirectos/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
  ],
  function (BaseController, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.Main", {

      /**
       * Se inicializa el controlador principal de la aplicación.
       * Se encarga de instanciar los modelos globales de alcance, tramos y estado de la interfaz.
       */
      onInit: async function () {

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
            dynamicRowCount: 10
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
        delete userData.userParameters;

        const appDataModel = new JSONModel({
          userData: userData,
          tramo: null
        });
        this.setGlobalModel(appDataModel, "appData");
        
        const tramo = await this.getTramos(userData);
        delete tramo.__metadata;
        appDataModel.setProperty("/tramo", tramo);

        this._showView("dashboard");
      },

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
              const norm = oDatosTramos.Norma;
              const normModel = new JSONModel({
                norma: norm
              });
              this.setGlobalModel(normModel, "normModel");

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
        oSideBar.setVisible(!oSideBar.getVisible());
      },

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

        // Se verifica si existen cambios sin guardar antes de abandonar la vista de "corrientes"
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
        }

        this._lastSelectedKey = sNewKey;
        this._showView(sNewKey);
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
 * Se inyecta dinamicamente la vista seleccionada en el contenedor de contenido.
 * Se utiliza una cache interna (_mViews) para no volver a instanciar vistas ya creadas.
 * Se asigna ademas una retrollamada al controlador hijo para que pueda actualizar
 * visualmente el checkbox idEjecutadoCheckBox2 que reside en la Main view.
 */
_showView: async function (sKey) {
    const oContainer = this.byId("tabContent");
    oContainer.removeAllItems();
    const oComp = this.getOwnerComponent();

    if (!this._mViews[sKey]) {
        this._mViews[sKey] = await oComp.runAsOwner(() =>
            sap.ui.xmlview({
                height: "100%",
                layoutData: new sap.m.FlexItemData({ growFactor: 1 }),
                viewName: "masterindirectos.view.DetailsViews." + this._mapKeyToView(sKey),
            })
        );
    }

    oContainer.addItem(this._mViews[sKey]);

    const oActiveController = this._mViews[sKey].getController();

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
              viewName: "masterindirectos.view.DialogsViews.ScopeSelector",
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
                  if (tramosByObra.NavTramosDatos.results.length > 0) {
                    const norm = tramosByObra.NavTramosDatos.results[0].Norma;
                    this.getGlobalModel("normModel").setProperty("/norma", norm);
                  }
                  this.setUserScopeData();
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
       * Se configura la información de usuario y se actualizan los datos de la vista activa.
       */
      setUserScopeData: function () {
        const appData = this.getGlobalModel("appData").getData();
        const userConfig = appData.userData;
        
        this.callExternalService(this.getEndpointData().urlInsite + "/menu/mainMenu", "GET", {
          idUser: userConfig.idUser,
          loginUser: userConfig.User,
          idLanguageApp: userConfig.AplicationLangu,
          idLanguage: userConfig.Langu,
          erpNode: userConfig.initialNode,
          erpCountry: null,
          erpRegion: null,
          idHierarchy: "FERR",
          idApplication: "FIDE"
        }).then(function (response) {
          // Se obtiene la vista del IconTabBar para refrescar los datos internos.
          const oIconTabBar = this.getView().byId("itb");
          const currentKey = oIconTabBar.getSelectedKey();
          const currentView = this._mViews[currentKey];
          
          if (currentView && currentView.getController().setInitData) {
            currentView.getController().setInitData();
          }

        }.bind(this));
      },

      /**
       * Se actualiza el modelo que controla la visibilidad global de las columnas ejecutadas.
       */
      onMainEjecutadoToggle: function(oEvent) {
        const bSelected = oEvent.getParameter("selected");
        this.getView().getModel("visibleColumn").setProperty("/visible", bSelected);
      }

    });
  }
);