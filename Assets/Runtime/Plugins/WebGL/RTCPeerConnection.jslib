var UnityWebRTCPeerConnection = {
  CreatePeerConnection: function (conf) {
    var label = '';
    if (conf) {
      label = conf.label;
      delete conf.label;
    }

    //debugger;
    conf = conf || {};
    var peer = new RTCPeerConnection(conf);
    peer.label = label;
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'CreatePeerConnection', 'create peer: ' + peer.label);
    peer.onicecandidate = function (evt) {
      var cnd = evt.candidate;
      // TODO evt.candidate === null (candidate collect end)
      if (cnd) {
        uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'onicecandidate', JSON.stringify(evt.candidate.toJSON()));
        uwcom_addManageObj(cnd);
        var candidatePtr = uwcom_strToPtr(cnd.candidate);
        var sdpMidPtr = uwcom_strToPtr(cnd.sdpMid);
        Module.dynCall_viiiii(uwevt_PCOnIceCandidate, this.managePtr, cnd.managePtr, candidatePtr, sdpMidPtr, cnd.sdpMLineIndex);
      }
    };
    peer.oniceconnectionstatechange = function (evt) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'oniceconnectionstatechange', this.label + ':' +  this.iceConnectionState);
      var idx = UWRTCIceConnectionState.indexOf(this.iceConnectionState);
      if (idx === -1) {
        console.error('unknown iceConnectionState: "' + this.iceConnectionState + '"');
      }
      Module.dynCall_vii(uwevt_PCOnIceConnectionChange, this.managePtr, idx);
    };
    peer.onconnectionstatechange = function (evt) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'onconnectionstatechange', this.label + ':' +this.connectionState);
      var idx = UWRTCPeerConnectionState.indexOf(this.connectionState);
      Module.dynCall_vii(uwevt_PCOnConnectionStateChange, this.managePtr, idx);
    };
    peer.onicegatheringstatechange = function (evt) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'onicegatheringstatechange', this.label + ':' +this.iceGatheringState);
      var idx = UWRTCIceGatheringState.indexOf(this.iceGatheringState);
      if (idx === -1) {
        console.error('unknown iceGatheringState: "' + this.iceGatheringState + '"');
      }
      Module.dynCall_vii(uwevt_PCOnIceGatheringChange, this.managePtr, idx);
    };
    peer.onnegotiationneeded = function (evt) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'onnegotiationneeded', this.label);
      Module.dynCall_vi(uwevt_PCOnNegotiationNeeded, this.managePtr);
    };
    peer.ondatachannel = function (evt) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'ondatachannel', this.label + ':' + evt.channel.label);
      var channel = evt.channel;
      uwcom_addManageObj(channel);
      Module.dynCall_vii(uwevt_PCOnDataChannel, this.managePtr, channel.managePtr);
    };
    peer.ontrack = function (evt) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'ontrack', this.label + ':' + evt.track.kind);
      var receiver = evt.receiver;
      var transceiver = evt.transceiver;
      var track = evt.track;
      if(evt.streams[0])
        evt.streams[0].removeTrack(track);
      uwcom_addManageObj(receiver);
      uwcom_addManageObj(transceiver);
      uwcom_addManageObj(track);
      if (track.kind === 'audio') {
        var audio = new Audio();
        // TODO already exists check 
        audio.id = 'audio_' + track.managePtr.toString();
        audio.style.display = 'none';
        audio.srcObject = evt.streams[0];
        document.body.appendChild(audio);
        audio.play();
        uwcom_remoteAudioTracks[track.managePtr] = {
          track: track,
          audio: new Audio()
        };
        Module.dynCall_vii(uwevt_PCOnTrack, peer.managePtr, transceiver.managePtr);
      } else if (track.kind === 'video') {
        // TODO already exists check 
        // var video = document.createElement('video');
        // video.id = 'video_' + track.managePtr.toString();
        // video.muted = true;
        // video.style.display = 'none';
        // video.onloadedmetadata = function (evt) {
        //   // TODO Realtime resize
          Module.dynCall_vii(uwevt_PCOnTrack, peer.managePtr, transceiver.managePtr);
        // };
        // video.srcObject = evt.streams[0];
        // document.body.appendChild(video);
        // uwcom_remoteVideoTracks[track.managePtr] = {
        //   track: track,
        //   video: video
        // };
        // video.play(); 
      }
    };
    uwcom_addManageObj(peer);
    return peer.managePtr;
  },

  CreatePeerConnectionWithConfig: function (confPtr) {
    var confJson = Pointer_stringify(confPtr);
    var conf = JSON.parse(confJson);
    conf.bundlePolicy = 'bundlePolicy' in conf ? conf.bundlePolicy : 0;
    conf.bundlePolicy = UWRTCBundlePolicy[conf.bundlePolicy];
    conf.iceTransportPolicy = 'iceTransportPolicy' in conf ? conf.iceTransportPolicy : 3;
    conf.iceTransportPolicy = UWRTCIceTransportPolicy.indexOf[conf.iceTransportPolicy];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'CreatePeerConnectionWithConfig', JSON.stringify(conf));
    var ptr = _CreatePeerConnection(conf);
    return ptr;
  },

  PeerConnectionSetDescription: function (peerPtr, typeIdx, sdpPtr, side) {
    var peer = UWManaged[peerPtr];
    var type = UWRTCSdpType[typeIdx];
    var sdp = Pointer_stringify(sdpPtr);
    peer['set' + side + 'Description']({ type: type, sdp: sdp }).then(function () {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionSetDescription', peer.label + ':' + side + ':' + type + ':' /*+ sdp*/);
      Module.dynCall_vi(uwevt_OnSetSessionDescSuccess, peer.managePtr);
    }).catch(function (err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionSetDescription', peer.label + ':' + side + ':' + err.message);
      var errorNo = uwcom_errorNo(err);
      var errMsgPtr = uwcom_strToPtr(err.message);
      Module.dynCall_viii(uwevt_OnSetSessionDescFailure, peer.managePtr, errorNo, errMsgPtr);
    });
  },

  PeerConnectionIceConditionState: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionIceConditionState', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var idx = UWRTCIceConnectionState.indexOf(peer.iceConnectionState);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionIceConditionState', peer.label + ':' + peer.iceConnectionState);
    return idx;
  },

  PeerConnectionState: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionState', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var idx = UWRTCPeerConnectionState.indexOf(peer.connectionState);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionState', peer.label + ':' + peer.connectionState);
    return idx;
  },

  PeerConnectionSignalingState: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionSignalingState', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var idx = UWRTCSignalingState.indexOf(peer.signalingState);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionSignalingState', peer.label + ':' + peer.signalingState);
    return idx;
  },

  PeerConnectionIceGatheringState: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionIceGatheringState', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var idx = UWRTCIceGathererState.indexOf(peer.iceGatheringState);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionIceGatheringState', peer.label + ':' + peer.iceGatheringState);
    return idx;
  },

  PeerConnectionGetReceivers: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetReceivers', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var receivers = peer.getReceivers();
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetReceivers', peer.label + ': receivers=' + receivers.length);
    var ptrs = [];
    receivers.forEach(function (receiver) {
      uwcom_addManageObj(receiver);
      ptrs.push(receiver.managePtr);
    });
    var ptr = uwcom_arrayToReturnPtr(ptrs, Int32Array);
    return ptr;
  },

  PeerConnectionGetSenders: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetSenders', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var senders = peer.getSenders();
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetSenders', peer.label + ': senders=' + senders.length);
    var ptrs = [];
    senders.forEach(function (sender) {
      uwcom_addManageObj(sender);
      ptrs.push(sender.managePtr);
    });
    var ptr = uwcom_arrayToReturnPtr(ptrs, Int32Array);
    return ptr;
  },

  PeerConnectionGetTransceivers: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetTransceivers', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var transceivers = peer.getTransceivers();
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetTransceivers', peer.label + ': transceivers=' + transceivers.length);
    var ptrs = [];
    transceivers.forEach(function (transceiver) {
      uwcom_addManageObj(transceiver);
      ptrs.push(transceiver.managePtr);
    });
    var ptr = uwcom_arrayToReturnPtr(ptrs, Int32Array);
    return ptr;
  },

  PeerConnectionGetConfiguration: function (evt) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetConfiguration', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var conf = peer.getConfiguration();
    confJson = JSON.stringify(conf);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetConfiguration', peer.label + ':' + confJson);
    var ptr = uwcom_strToPtr(confJson);
    return ptr;
  },

  PeerConnectionSetConfiguration: function (peerPtr, confPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionSetConfiguration', 'peer')) return 11; // OperationErrorWithData
    try {
      var peer = UWManaged[peerPtr];
      var confJson = Pointer_stringify(confPtr);
      var conf = JSON.parse(confJson);
      conf.bundlePolicy = 'bundlePolicy' in conf ? conf.bundlePolicy : 0;
      conf.bundlePolicy = UWRTCBundlePolicy[conf.bundlePolicy];
      conf.iceTransportPolicy = 'iceTransportPolicy' in conf ? conf.iceTransportPolicy : 3;
      conf.iceTransportPolicy = UWRTCIceTransportPolicy[conf.iceTransportPolicy];
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionSetConfiguration', peer.label + ':' + JSON.stringify(conf));
      peer.setConfiguration(conf);
      return 0;
    } catch (err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionSetConfiguration', peer.label + ':' + err.message);
      return uwcom_errorNo(err);
    }
  },

  PeerConnectionRegisterCallbackCreateSD: function (peerPtr, OnSuccessCreateSessionDesc, OnFailureCreateSessionDesc) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterCallbackCreateSD', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterCallbackCreateSD', peer.label);
    uwevt_OnSuccessCreateSessionDesc = OnSuccessCreateSessionDesc;
    uwevt_OnFailureCreateSessionDesc = OnFailureCreateSessionDesc;
  },

  PeerConnectionRegisterCallbackCollectStats: function (peerPtr, OnStatsDeliveredCallback) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterCallbackCollectStats', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterCallbackCollectStats', peer.label);
    uwevt_OnStatsDeliveredCallback = OnStatsDeliveredCallback;
  },

  PeerConnectionRegisterIceConnectionChange: function (peerPtr, PCOnIceConnectionChange) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterIceConnectionChange', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterIceConnectionChange', peer.label);
    uwevt_PCOnIceConnectionChange = PCOnIceConnectionChange;
  },

  PeerConnectionRegisterConnectionStateChange: function (peerPtr, PCOnConnectionStateChange) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterConnectionStateChange', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterConnectionStateChange', peer.label);
    uwevt_PCOnConnectionStateChange = PCOnConnectionStateChange;
  },

  PeerConnectionRegisterIceGatheringChange: function (peerPtr, PCOnIceGatheringChange) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterIceGatheringChange', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterIceGatheringChange', peer.label);
    uwevt_PCOnIceGatheringChange = PCOnIceGatheringChange;
  },

  PeerConnectionRegisterOnIceCandidate: function (peerPtr, PCOnIceCandidate) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterOnIceCandidate', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterOnIceCandidate', peer.label);
    uwevt_PCOnIceCandidate = PCOnIceCandidate;
  },

  PeerConnectionRegisterOnDataChannel: function (peerPtr, PCOnDataChannel) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterOnDataChannel', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterOnDataChannel', peer.label);
    uwevt_PCOnDataChannel = PCOnDataChannel;
  },

  PeerConnectionRegisterOnRenegotiationNeeded: function (peerPtr, PCOnNegotiationNeeded) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterOnRenegotiationNeeded', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterOnRenegotiationNeeded', peer.label);
    uwevt_PCOnNegotiationNeeded = PCOnNegotiationNeeded;
  },

  PeerConnectionRegisterOnTrack: function (peerPtr, PCOnTrack) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRegisterOnTrack', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRegisterOnTrack', peer.label);
    uwevt_PCOnTrack = PCOnTrack;
  },

  PeerConnectionClose: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionClose', 'peer')) return;
    var peer = UWManaged[peerPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionClose', peer.label);
    peer.close();
  },

  PeerConnectionAddTrack: function (peerPtr, trackPtr, streamPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionAddTrack', 'peer')) return;
    if (!uwcom_existsCheck(trackPtr, 'PeerConnectionAddTrack', 'track')) return;
    var peer = UWManaged[peerPtr];
    var track = UWManaged[trackPtr];
    var stream = null;
    if (streamPtr === 0) {
      stream = new MediaStream();
      uwcom_addManageObj(stream);
    } else {
      if (!uwcom_existsCheck(streamPtr, 'PeerConnectionAddTrack', 'stream')) return;
      stream = UWManaged[streamPtr];
    }
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionAddTrack', peer.label + ':' + track.kind);
    var sender = peer.addTrack(track);//, stream);
    uwcom_addManageObj(sender);
    return sender.managePtr;
  },

  PeerConnectionRemoveTrack: function (peerPtr, senderPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionRemoveTrack', 'peer')) return;
    if (!uwcom_existsCheck(senderPtr, 'PeerConnectionRemoveTrack', 'sender')) return;
    var peer = UWManaged[peerPtr];
    var sender = UWManaged[senderPtr];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionRemoveTrack', peer.label + ':' + sender.track.kind);
    peer.removeTrack(sender);
  },

  PeerConnectionAddTransceiver: function (peerPtr, trackPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionAddTransceiver', 'peer')) return;
    if (!uwcom_existsCheck(trackPtr, 'PeerConnectionAddTransceiver', 'track')) return;
    var peer = UWManaged[peerPtr];
    var track = UWManaged[trackPtr];
    var transceiver = peer.addTransceiver(track);
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionAddTransceiver', peer.label + ':' + track.kind);
    uwcom_addManageObj(transceiver);
    return transceiver.managePtr;
  },

  PeerConnectionAddTransceiverWithType: function (peerPtr, kindIdx) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionAddTransceiverWithType', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var kind = UWMediaStreamTrackKind[kindIdx];
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionAddTransceiverWithType', peer.label + ':' + kind);
    var transceiver = peer.addTransceiver(kind);
    uwcom_addManageObj(transceiver);
    return transceiver.managePtr;
  },

  PeerConnectionAddIceCandidate: function (peerPtr, candidatePtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionAddIceCandidate', 'peer')) return;
    if (!uwcom_existsCheck(candidatePtr, 'PeerConnectionAddIceCandidate', 'candidate')) return;
    var peer = UWManaged[peerPtr];
    try {
      var candidate = UWManaged[candidatePtr];
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionAddIceCandidate', peer.label + ':' + JSON.stringify(candidate));
      peer.addIceCandidate(candidate);
      return true;
    } catch (err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionAddIceCandidate', peer.label + ':' + err.message);
      return false;
    }
  },

  PeerConnectionCreateOffer: function (peerPtr, iceRestart, offerToReceiveAudio, offerToReceiveVideo) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionCreateOffer', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var options = {
      iceRestart: !!iceRestart,
      offerToReceiveAudio: !!offerToReceiveAudio,
      offerToReceiveVideo: !!offerToReceiveVideo
    };
    peer.createOffer(options).then(function (offer) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionCreateOffer', peer.label + ':' + JSON.stringify(options) + ':' + offer.type);
      uwcom_addManageObj(offer);
      var sdpPtr = uwcom_strToPtr(offer.sdp);
      Module.dynCall_viii(uwevt_OnSuccessCreateSessionDesc, peerPtr, 0, sdpPtr); // 0 === offer
    }).catch(function (err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionCreateOffer', peer.label + ':' + err.message);
      var errorNo = uwcom_errorNo(err);
      var errMsgPtr = uwcom_strToPtr(err.message);
      Module.dynCall_viii(uwevt_OnFailureCreateSessionDesc, peerPtr, errorNo, errMsgPtr);
    });
  },

  PeerConnectionCreateAnswer: function (peerPtr, iceRestart) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionCreateAnswer', 'peer')) return;
    var peer = UWManaged[peerPtr];
    var options = {
      iceRestart: !!iceRestart
    };
    peer.createAnswer(options).then(function (answer) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionCreateAnswer', peer.label + ':' + JSON.stringify(options) + ':' + answer.type);
      uwcom_addManageObj(answer);
      var sdpPtr = uwcom_strToPtr(answer.sdp);
      Module.dynCall_viii(uwevt_OnSuccessCreateSessionDesc, peerPtr, 2, sdpPtr); // 2 == answer
    }).catch(function (err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionCreateAnswer', peer.label + ':' + err.message);
      var errorNo = uwcom_errorNo(err);
      var errMsgPtr = uwcom_strToPtr(err.message);
      Module.dynCall_viii(uwevt_OnFailureCreateSessionDesc, peerPtr, errorNo, errMsgPtr);
    });
  },

  PeerConnectionGetStats: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetStats', 'peer')) return;
    var peer = UWManaged[peerPtr];
    peer.getStats().then(function (stats) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetStats', peer.label + ': stats=' + stats.length);
      uwcom_addManageObj(stats);
      Module.dynCall_vii(uwevt_OnStatsDeliveredCallback, peer.managePtr, stats.managePtr);
    }).catch(function(err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionGetStats', peer.label + ':' + err.message);
    }); 
  },

  PeerConnectionTrackGetStats: function (peerPtr, trackPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionTrackGetStats', 'peer')) return;
    if (!uwcom_existsCheck(trackPtr, 'PeerConnectionTrackGetStats', 'track')) return;
    var peer = UWManaged[peerPtr];
    var track = UWManaged[trackPtr];
    peer.getStats(track).then(function (stats) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionTrackGetStats', peer.label + ':' + track.kind + ':stats=' + stats.length);
      uwcom_addManageObj(stats);
      Module.dynCall_vii(uwevt_OnStatsDeliveredCallback, peer.managePtr, stats.managePtr);
    }).catch(function(err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionTrackGetStats', peer.label + ':' + err.message);
    });
  },

  PeerConnectionSenderGetStats: function (peerPtr, senderPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionSenderGetStats', 'peer')) return;
    if (!uwcom_existsCheck(senderPtr, 'PeerConnectionSenderGetStats', 'sender')) return;
    var peer = UWManaged[peerPtr];
    var sender = UWManaged[senderPtr];
    sender.getStats().then(function (stats) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionSenderGetStats', peer.label + ':' + sender.track.kind + ':stats=' + stats.length);
      uwcom_addManageObj(stats);
      Module.dynCall_vii(uwevt_OnStatsDeliveredCallback, peer.managePtr, stats.managePtr);
    }).catch(function(err) {
      uwcom_debugLog('error', 'RTCPeerConnection.jslib', 'PeerConnectionSenderGetStats', peer.label + ':' + err.message);
    });
  },

  PeerConnectionReceiverGetStats: function (peerPtr, receiverPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionReceiverGetStats', 'peer')) return;
    if (!uwcom_existsCheck(receiverPtr, 'PeerConnectionReceiverGetStats', 'receiver')) return;
    var peer = UWManaged[peerPtr];
    var receiver = UWManaged[receiverPtr];
    receiver.getStats().then(function (stats) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionReceiverGetStats', peer.label + ':' + receiver.track.kind + ':stats=' + stats.length);
      uwcom_addManageObj(stats);
      Module.dynCall_vii(uwevt_OnStatsDeliveredCallback, peer.managePtr, stats.managePtr);
    }).catch(function(err) {
      uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionReceiverGetStats', peer.label + ':' + err.message);
    })
  },

  PeerConnectionGetLocalDescription: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetLocalDescription', 'peer')) return 'false';
    var peer = UWManaged[peerPtr];
    if (!peer.localDescription) return 'false';
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetLocalDescription', peer.label + ':' + pc.localDescription.type);
    var type = UWRTCSdpType.indexOf(peer.localDescription.type);
    var sdp = peer.localDescription.sdp;
    return JSON.stringify({ type: type, sdp: sdp });
  },

  PeerConnectionGetRemoteDescription: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetRemoteDescription', 'peer')) return 'false';
    var peer = UWManaged[peerPtr];
    if (!peer.remoteDescription) return 'false';
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetRemoteDescription', peer.label + ':' + pc.remoteDescription.type);
    var type = UWRTCSdpType.indexOf(peer.remoteDescription.type);
    var sdp = peer.remoteDescription.sdp;
    return JSON.stringify({ type: type, sdp: sdp });
  },

  PeerConnectionGetCurrentLocalDescription: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetCurrentLocalDescription', 'peer')) return 'false';
    var peer = UWManaged[peerPtr];
    if (!peer.currentLocalDescription) return 'false';
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetCurrentLocalDescription', peer.label + ':' + pc.currentLocalDescription.type);
    var type = UWRTCSdpType.indexOf(peer.currentLocalDescription.type);
    var sdp = peer.currentLocalDescription.sdp;
    return JSON.stringify({ type: type, sdp: sdp });
  },

  PeerConnectionGetCurrentRemoteDescription: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetCurrentRemoteDescription', 'peer')) return 'false';
    var peer = UWManaged[peerPtr];
    if (!peer.currentRemoteDescription) return 'false';
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetCurrentRemoteDescription', peer.label + ':' + pc.currentRemoteDescription.type);
    var type = UWRTCSdpType.indexOf(peer.currentRemoteDescription.type);
    var sdp = peer.currentRemoteDescription.sdp;
    return JSON.stringify({ type: type, sdp: sdp });
  },

  PeerConnectionGetPendingLocalDescription: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetPendingLocalDescription', 'peer')) return 'false';
    var peer = UWManaged[peerPtr];
    if (!peer.pendingLocalDescription) return 'false';
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetPendingLocalDescription', peer.label + ':' + pc.pendingLocalDescription.type);
    var type = UWRTCSdpType.indexOf(peer.pendingLocalDescription.type);
    var sdp = peer.pendingLocalDescription.sdp;
    return JSON.stringify({ type: type, sdp: sdp });
  },

  PeerConnectionGetPendingRemoteDescription: function (peerPtr) {
    if (!uwcom_existsCheck(peerPtr, 'PeerConnectionGetPendingRemoteDescription', 'peer')) return 'false';
    var peer = UWManaged[peerPtr];
    if (!peer.pendingRemoteDescription) return 'false';
    uwcom_debugLog('log', 'RTCPeerConnection.jslib', 'PeerConnectionGetPendingRemoteDescription', peer.label + ':' + pc.pendingRemoteDescription.type);
    var type = UWRTCSdpType.indexOf(peer.pendingRemoteDescription.type);
    var sdp = peer.pendingRemoteDescription.sdp;
    return JSON.stringify({ type: type, sdp: sdp });
  }
};
mergeInto(LibraryManager.library, UnityWebRTCPeerConnection);