sap.ui.define(
    [
        "sap/m/Dialog"
    ],

    function (Dialog) {
        "use strict";
        return {

            createDialog: function (data, context) {

                var showAcceptButton = function (d) {
                    return !!d.textAccept;
                };
                var showDeclineButton = function (d) {
                    return !!d.textDecline
                };
                var showCloseButton = function (d) {
                    return !!d.closeButton;
                };
                const dialog = new Dialog({
                    escapeHandler: function (evt) {
                        if (showCloseButton(data)) {
                            if (data.onClose) {
                                data.onClose.apply(data.context);
                            }
                            dialog.close();
                        }
                    },
                    type: "Message",
                    contentWidth: data.width,
                    contentHeight: data.height,
                    customHeader: new sap.m.Bar({
                        contentLeft: [new sap.m.Title({
                            text: data.title || "",
                        })],
                        type: sap.m.DialogType.Message,
                        contentRight: [new sap.m.Button({
                            icon: "sap-icon://decline",
                            tooltip: data.textDecline,
                            visible: showCloseButton(data),
                            press: function (evt) {
                                if (data.onClose) {
                                    data.onClose.apply(data.context);
                                }
                                dialog.close();
                            }
                        })]
                    }).addStyleClass("headerBar"),
                    afterClose: function (evt) {
                        dialog.destroy();
                    }
                })

                if (showAcceptButton(data)) {
                    dialog.addButton(new sap.m.Button({
                        icon: "sap-icon://accept",
                        tooltip: data.textAccept,
                        text: data.textAccept,
                        press: function (evt) {
                            if (data.onAccept) {
                                data.onAccept.apply(data.context);
                            }
                            dialog.close();
                        }
                    }));
                }

                if (showDeclineButton(data)) {
                    dialog.addButton(new sap.m.Button({
                        icon: "sap-icon://decline",
                        tooltip: data.textDecline,
                        text: data.textDecline,
                        press: function (evt) {
                            if (data.onDecline) {
                                data.onDecline.apply(data.context);
                            }
                            dialog.close();
                        }
                    }));
                }

                if (data.messages && data.messages.length) {
                    data.messages.forEach(function (message) {
                        let messageStrip = new sap.m.MessageStrip({
                            text: message.text,
                            type: message.type || "Information",
                            showIcon: data.showIcon || true,
                        })

                        dialog.addContent(messageStrip);
                    })
                }

                return dialog;
            }

        }
    }
)