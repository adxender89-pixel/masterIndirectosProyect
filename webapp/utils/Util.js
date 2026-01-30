sap.ui.define([], function () {
    "use strict";

    return {
        calculateSum: function (aItems) {
            if (!aItems) return 0;
            return aItems.reduce((acc, item) => acc + parseFloat(item.importe || 0), 0);
        },
        /**
         * Function for show sap-message header when realice odata CRUD operation
         * @param {object} response 
         * @param {string} sTitle 
         * @param {boolean} bShowAsMessageToastWhenIsJustOneMessage Display message as MessageToast when is just one message
         * instead of using a MessageView dialog
         * @returns true if show messages / false no messages to show
         */
        show: function (oResponse, sTitle, bShowAsMessageToastWhenIsJustOneMessage) {
            let aResults = this.get(oResponse),
                bShowToast = bShowAsMessageToastWhenIsJustOneMessage === undefined ? true : bShowAsMessageToastWhenIsJustOneMessage,
                nErrorMessages = aResults.filter(item => item.type === 'Error').length;

            if (aResults.length === 1 && bShowToast)
                MessageToast.show(aResults[0].title);
            else if (aResults.length !== 0)
                this._openDialogError(aResults, sTitle);

            console.log("showSapMessages: ", (!!oResponse.headers["sap-message"]));
            return ((nErrorMessages > 0));
        },

        /**
         * Function to get sap-message header from response
         * @param {*} oResponse 
         * @returns an array of sap-messages 
         */
        getSapMessage: function (oResponse) {
            var aResults = [];
            if (oResponse?.headers["sap-message"]) {
                const oSapMessage = JSON.parse(oResponse.headers["sap-message"]);
                let oResult = {
                    type: this._getErrorType(oSapMessage.severity),
                    title: oSapMessage.message,
                    description: oSapMessage.target,
                    subtitle: oSapMessage.target.code
                };
                aResults.push(oResult);
                if (oSapMessage.details.length > 0)
                    for (let i = 0; i < oSapMessage.details.length; i++) {
                        let oResult = {
                            type: this._getErrorType(oSapMessage.details[i].severity),
                            title: oSapMessage.details[i].message,
                            description: oSapMessage.details[i].target,
                            subtitle: oSapMessage.details[i].target.code
                        };
                        aResults.push(oResult);
                    }
            }
            return aResults;
        },

        /**************************************** */
        /*          Internal methods              */
        /**************************************** */

        /**
         * 
         * @param {*} aErrorMessages 
         * @param {*} sTitle 
         */
        _openDialogError: function (aErrorMessages, sTitle) {
            debugger
            if (!this.oMessageView) {
                // var oLibraryBundle = sap.ui.getCore().getLibraryResourceBundle("reusable.utils"),
                var oLibraryBundle = Helper.getResourceBundle(),
                    oMessageTemplate = new MessageItem({
                        type: '{type}',
                        title: '{title}',
                        description: '{description}',
                        subtitle: '{subtitle}'
                    }),
                    oContext = this;

                const oBackButton = new Button({
                    icon: IconPool.getIconURI("nav-back"),
                    visible: false,
                    press: function () {
                        oContext.oMessageView.navigateBack();
                        this.setVisible(false);
                    }
                });

                this.oMessageView = new MessageView({
                    showDetailsPageHeader: false,
                    itemSelect: function () {
                        oBackButton.setVisible(true);
                    },
                    items: {
                        path: "/",
                        template: oMessageTemplate
                    }
                });

                this.oDialog = new Dialog({
                    resizable: true,
                    content: this.oMessageView,
                    state: 'Error',
                    beginButton: new Button({
                        press: oEvent => { oContext.oDialog.close() },
                        text: oLibraryBundle.getText("btnClose")
                    }),
                    customHeader: new Bar({
                        titleAlignment: sap.m.TitleAlignment.Auto,
                        contentMiddle: [
                            new Text({ text: (sTitle) ? sTitle : oLibraryBundle.getText("lblError") })
                        ],
                        contentLeft: [oBackButton]
                    }),
                    contentHeight: "50%",
                    contentWidth: "50%",
                    verticalScrolling: false
                });
            }
            let oModel = new JSONModel(aErrorMessages);
            this.oMessageView.setModel(oModel);
            oModel.refresh();
            this.oMessageView.navigateBack();
            this.oDialog.open();
        },

        /**
         * 
         * @param {*} sSeverity 
         * @returns 
         */
        _getErrorType: sSeverity => {
            switch (sSeverity) {
                case "error":
                    return ("Error");
                case "warning":
                    return ("Warning");
                case "success":
                    return ("Success");
                default:
                    return ("None");
            }
        },
    };
});