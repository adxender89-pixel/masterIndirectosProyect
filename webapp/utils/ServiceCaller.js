sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Realiza una llamada HTTP usando fetch
         */
        callService: function (sUrl, sMethod = "GET", oPayload = null, oHeaders = {}) {
            const oOptions = {
                method: sMethod,
                headers: {
                    // "Content-Type": "application/json",
                    ...oHeaders
                },
                data: oPayload ? JSON.stringify(oPayload) : null
            };

            return new Promise((resolve, reject) => {
                $.ajax({
                    async: true,
                    method: sMethod,
                    url: sUrl,
                    data: oPayload,
                    beforeSend: function (ajaxRequest) {
                        for (var header in oHeaders) {
                            ajaxRequest.setRequestHeader(header, oHeaders[header]);
                        }
                    },
                    success: function (result, status, xhr) {
                        resolve(result);
                    },
                    error: function (xhr, status, result) {
                        var error = {
                            desc: undefined,
                            lines: undefined
                        };
                        reject(error);
                    },
                    complete: function (xhr, status) {
                    }
                });
            });

        }
    };
});