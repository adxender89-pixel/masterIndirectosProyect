/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "zindirect_costs/model/models"
    ],
    function (UIComponent, Device, models) {
        "use strict";

        return UIComponent.extend("zindirect_costs.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                //   Se fija el idioma de UI antes de invocar
                // UIComponent.prototype.init para que el ResourceModel del
                // manifest se cree con el bundle correcto (i18n_es, i18n_en
                // o i18n_fr). En UI5 1.71 no existe supportedLocales en
                // manifest, asi que se replica esa logica aqui con tres
                // niveles de prioridad:
                //   1) Preferencia explicita guardada por el usuario en el
                //      dialogo de UserConfig (localStorage).
                //   2) Idioma del navegador (navigator.language) si coincide
                //      con uno de los soportados (es/en/fr): asi un usuario
                //      frances o ingles ve la app en su idioma sin tocar nada.
                //   3) Fallback "es" (idioma del proyecto Ferrovial) si el
                //      navegador habla cualquier otro idioma (it, de, pt...).
                //  
                try {
                    var aSupported = /^(es|en|fr)$/;
                    var sStoredLang = window.localStorage && window.localStorage.getItem("zindirect_costs_app_lang");
                    var sUiLang;
                    if (sStoredLang && aSupported.test(sStoredLang)) {
                        sUiLang = sStoredLang;
                    } else {
                        var sNavLang = (navigator.language || "").slice(0, 2).toLowerCase();
                        sUiLang = aSupported.test(sNavLang) ? sNavLang : "es";
                    }
                    sap.ui.getCore().getConfiguration().setLanguage(sUiLang);
                } catch (e) {
                    // Se ignora cualquier excepcion (modo privado, storage
                    // deshabilitado); UI5 cae al fallback generico.
                }
                //  

                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                //CREA Y SETEA EL MODELO DE ENDPOINTS
                this.setModel(models.createEndpointModel(), "endpointModel");

                //CREA Y SETEA EL MODELO GLOBAL DE URLs MASTER
                this.setModel(models.createUrlsMasterModel(), "urlsMaster");
                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            }
        });
    }
);