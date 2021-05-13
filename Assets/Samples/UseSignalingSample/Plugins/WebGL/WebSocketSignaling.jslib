mergeInto(LibraryManager.library, {
    $ws: null,
    $ws_OnOpen: null,
    $ws_OnMessage: null,
    $ws_OnClose: null,
    $ws_OnError: null,

    WebSocketSignalingInit__deps: ['$ws', '$ws_OnOpen', '$ws_OnMessage', '$ws_OnClose', '$ws_OnError'],
    WebSocketSignalingInit: function (WSOnOpenPtr, WSOnMessagePtr, WSOnClosePtr, WSOnErrorPtr) {
        WSevt_OnOpen = WSOnOpenPtr;
        WSevt_OnMessage = WSOnMessagePtr;
        WSevt_OnClose = WSOnClosePtr;
        WSevt_OnError = WSOnErrorPtr;
    },

    WebSocketSignalingConnect: function (urlPtr) {
        var url = Pointer_stringify(urlPtr);
        ws = new WebSocket(url);

        ws.onopen = function () {
            Module.dynCall_v(WSevt_OnOpen);
        };

        ws.onmessage = function (evt) {
            console.log('--onmesssage: ' + evt.data);
            var msgPtr = uwcom_strToPtr(evt.data);
            Module.dynCall_vi(WSevt_OnMessage, msgPtr);
        };

        ws.onclose = function (evt) {
            var reasonPtr = uwcom_strToPtr(evt.reason);
            Module.dynCall_vii(WSevt_OnClose, reasonPtr, evt.code);
        };

        ws.onerror = function (evt) {
            Module.dynCall_v(WSevt_OnError);
        };
    },

    WebSocketSignalingSend: function(msgPtr) {
        var msg = Pointer_stringify(msgPtr);
        ws.send(msg);
    },

    WebSocketSignalingClose: function() {
        if (ws) {
            ws.close();
            ws = null;
        }
    }
});
